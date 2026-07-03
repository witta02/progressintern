package handlers

import (
	"internship-backend/config"
	"internship-backend/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetMyTemplates fetches evaluation templates created by the current user along with their criteria
func GetMyTemplates(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	rows, err := config.DB.Query(
		"SELECT id, created_by, name, is_active, created_at FROM evaluation_templates WHERE created_by = ? ORDER BY id DESC",
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch templates: " + err.Error()})
		return
	}
	defer rows.Close()

	var templates []models.EvaluationTemplate
	for rows.Next() {
		var t models.EvaluationTemplate
		if err := rows.Scan(&t.ID, &t.CreatedBy, &t.Name, &t.IsActive, &t.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan template: " + err.Error()})
			return
		}
		t.Criteria = []models.EvaluationCriterion{}
		templates = append(templates, t)
	}

	// Fetch criteria for all templates
	for i := range templates {
		critRows, err := config.DB.Query(
			"SELECT id, template_id, label, max_score, sort_order FROM evaluation_criteria WHERE template_id = ? ORDER BY sort_order ASC, id ASC",
			templates[i].ID,
		)
		if err != nil {
			continue
		}
		defer critRows.Close()

		for critRows.Next() {
			var crit models.EvaluationCriterion
			if err := critRows.Scan(&crit.ID, &crit.TemplateID, &crit.Label, &crit.MaxScore, &crit.SortOrder); err == nil {
				templates[i].Criteria = append(templates[i].Criteria, crit)
			}
		}
	}

	c.JSON(http.StatusOK, templates)
}

// CreateTemplate creates an evaluation template with criteria
func CreateTemplate(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input struct {
		Name     string                       `json:"name" binding:"required"`
		Criteria []models.EvaluationCriterion `json:"criteria" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction: " + err.Error()})
		return
	}

	res, err := tx.Exec(
		"INSERT INTO evaluation_templates (created_by, name) VALUES (?, ?)",
		userID, input.Name,
	)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert template: " + err.Error()})
		return
	}

	templateID, err := res.LastInsertId()
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get template ID: " + err.Error()})
		return
	}

	for i, crit := range input.Criteria {
		_, err = tx.Exec(
			"INSERT INTO evaluation_criteria (template_id, label, max_score, sort_order) VALUES (?, ?, ?, ?)",
			templateID, crit.Label, crit.MaxScore, i,
		)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert criterion: " + err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Template created successfully", "id": templateID})
}

// UpdateTemplate updates a template's name and its criteria
func UpdateTemplate(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	templateIDStr := c.Param("id")
	templateID, _ := strconv.Atoi(templateIDStr)

	// Verify template ownership
	var count int
	err := config.DB.QueryRow(
		"SELECT COUNT(*) FROM evaluation_templates WHERE id = ? AND created_by = ?",
		templateID, userID,
	).Scan(&count)
	if err != nil || count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		Name     string                       `json:"name" binding:"required"`
		Criteria []models.EvaluationCriterion `json:"criteria"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction: " + err.Error()})
		return
	}

	// 1. Update template name
	_, err = tx.Exec(
		"UPDATE evaluation_templates SET name = ? WHERE id = ?",
		input.Name, templateID,
	)
	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update template name: " + err.Error()})
		return
	}

	// Keep track of criteria IDs that are kept
	var keptIDs []interface{}

	// 2. Process criteria
	for i, crit := range input.Criteria {
		if crit.ID > 0 {
			// Update existing criterion
			_, err = tx.Exec(
				"UPDATE evaluation_criteria SET label = ?, max_score = ?, sort_order = ? WHERE id = ? AND template_id = ?",
				crit.Label, crit.MaxScore, i, crit.ID, templateID,
			)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update criterion: " + err.Error()})
				return
			}
			keptIDs = append(keptIDs, crit.ID)
		} else {
			// Insert new criterion
			res, err := tx.Exec(
				"INSERT INTO evaluation_criteria (template_id, label, max_score, sort_order) VALUES (?, ?, ?, ?)",
				templateID, crit.Label, crit.MaxScore, i,
			)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert criterion: " + err.Error()})
				return
			}
			newID, err := res.LastInsertId()
			if err == nil {
				keptIDs = append(keptIDs, newID)
			}
		}
	}

	// 3. Delete criteria that were removed
	if len(keptIDs) > 0 {
		query := "DELETE FROM evaluation_criteria WHERE template_id = ? AND id NOT IN ("
		args := []interface{}{templateID}
		for i, id := range keptIDs {
			if i > 0 {
				query += ","
			}
			query += "?"
			args = append(args, id)
		}
		query += ")"
		_, err = tx.Exec(query, args...)
	} else {
		_, err = tx.Exec("DELETE FROM evaluation_criteria WHERE template_id = ?", templateID)
	}

	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clean up criteria: " + err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Template updated successfully"})
}

// DeleteTemplate deletes a template (criteria cascade)
func DeleteTemplate(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	templateIDStr := c.Param("id")
	templateID, _ := strconv.Atoi(templateIDStr)

	_, err := config.DB.Exec(
		"DELETE FROM evaluation_templates WHERE id = ? AND created_by = ?",
		templateID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete template: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Template deleted successfully"})
}

// AddCriterion adds a criterion to an existing template
func AddCriterion(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	templateIDStr := c.Param("id")
	templateID, _ := strconv.Atoi(templateIDStr)

	// Verify template ownership
	var count int
	err := config.DB.QueryRow(
		"SELECT COUNT(*) FROM evaluation_templates WHERE id = ? AND created_by = ?",
		templateID, userID,
	).Scan(&count)
	if err != nil || count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var input struct {
		Label    string `json:"label" binding:"required"`
		MaxScore int    `json:"max_score" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	res, err := config.DB.Exec(
		"INSERT INTO evaluation_criteria (template_id, label, max_score, sort_order) VALUES (?, ?, ?, 0)",
		templateID, input.Label, input.MaxScore,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add criterion: " + err.Error()})
		return
	}

	cid, _ := res.LastInsertId()
	c.JSON(http.StatusCreated, gin.H{"message": "Criterion added successfully", "id": cid})
}

// DeleteCriterion deletes a criterion from a template
func DeleteCriterion(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	criterionIDStr := c.Param("cid")
	criterionID, _ := strconv.Atoi(criterionIDStr)

	// Verify criterion template belongs to user
	var count int
	err := config.DB.QueryRow(
		`SELECT COUNT(*) FROM evaluation_criteria c 
		 JOIN evaluation_templates t ON c.template_id = t.id 
		 WHERE c.id = ? AND t.created_by = ?`,
		criterionID, userID,
	).Scan(&count)
	if err != nil || count == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	_, err = config.DB.Exec("DELETE FROM evaluation_criteria WHERE id = ?", criterionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete criterion: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Criterion deleted successfully"})
}

// SaveScores saves multiple evaluation scores for a submitted evaluation
func SaveScores(c *gin.Context) {
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var input struct {
		EvaluationID int                      `json:"evaluation_id" binding:"required"`
		Scores       []models.EvaluationScore `json:"scores" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}

	// Delete existing scores for this evaluation if any (for updates/overwrites)
	_, _ = tx.Exec("DELETE FROM evaluation_scores WHERE evaluation_id = ?", input.EvaluationID)

	for _, score := range input.Scores {
		_, err = tx.Exec(
			"INSERT INTO evaluation_scores (evaluation_id, criterion_id, score) VALUES (?, ?, ?)",
			input.EvaluationID, score.CriterionID, score.Score,
		)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save score: " + err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Scores saved successfully"})
}

// GetScores fetches scores for a given evaluation
func GetScores(c *gin.Context) {
	evalIDStr := c.Param("evalId")
	evalID, _ := strconv.Atoi(evalIDStr)

	rows, err := config.DB.Query(
		`SELECT s.id, s.evaluation_id, s.criterion_id, s.score, c.label, c.max_score 
		 FROM evaluation_scores s
		 JOIN evaluation_criteria c ON s.criterion_id = c.id
		 WHERE s.evaluation_id = ?`,
		evalID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch scores: " + err.Error()})
		return
	}
	defer rows.Close()

	var scores []models.EvaluationScore
	for rows.Next() {
		var s models.EvaluationScore
		if err := rows.Scan(&s.ID, &s.EvaluationID, &s.CriterionID, &s.Score, &s.Label, &s.MaxScore); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan score: " + err.Error()})
			return
		}
		scores = append(scores, s)
	}

	c.JSON(http.StatusOK, scores)
}

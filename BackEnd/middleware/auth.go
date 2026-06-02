package middleware

import (
	"fmt"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func jwtSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "change-me-in-production"
	}
	return []byte(secret)
}

// ========================================================
// 🔐 JWT MIDDLEWARE - ตรวจสอบ JWT Token ว่าถูกต้องหรือไม่
// ========================================================

type JWTClaims struct {
	UserID int    `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// AuthMiddleware ตรวจสอบ Authorization header มี JWT token ถูกต้องหรือไม่
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// ดึง Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "ไม่พบ Authorization header"})
			c.Abort()
			return
		}

		// แยก "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(401, gin.H{"error": "รูปแบบ Authorization header ไม่ถูกต้อง (ควรเป็น: Bearer <token>)"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse JWT Token
		claims := &JWTClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			// ตรวจสอบ signing method
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret(), nil
		})

		if err != nil || !token.Valid {
			c.JSON(401, gin.H{"error": "Token ไม่ถูกต้องหรือหมดอายุแล้ว"})
			c.Abort()
			return
		}

		// บันทึก user info ลงใน context เพื่อใช้อ้างอิงในดยาวหน้า handler
		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)

		c.Next()
	}
}

// ========================================================
// 🛡️ RBAC MIDDLEWARE - Role-Based Access Control
// ========================================================

// RequireRole ตรวจสอบว่า user มีบทบาท (role) ที่อนุญาตหรือไม่
// ตัวอย่างการใช้งาน:
//
//	r.POST("/api/jobs", middleware.RequireRole("company", "admin"), createJobHandler)
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// ดึง role จาก context (ต้องผ่าน AuthMiddleware ก่อน)
		role, exists := c.Get("role")
		if !exists {
			c.JSON(401, gin.H{"error": "ไม่พบข้อมูลผู้ใช้ในระบบ"})
			c.Abort()
			return
		}

		userRole := role.(string)

		// ตรวจสอบว่า role ของ user อยู่ใน allowedRoles หรือไม่
		isAuthorized := false
		for _, allowed := range allowedRoles {
			if userRole == allowed {
				isAuthorized = true
				break
			}
		}

		if !isAuthorized {
			c.JSON(403, gin.H{"error": "คุณไม่มีสิทธิ์เข้าถึงทรัพยากรนี้"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// ========================================================
// 🔒 OWNERSHIP CHECK - ตรวจสอบว่าเป็นเจ้าของข้อมูลหรือไม่
// ========================================================

// RequireOwnership ตรวจสอบว่า user เป็นเจ้าของข้อมูล (เช่น สว่นตัว)
// เช่น นักศึกษา A ไม่สามารถแก้ไข profile ของนักศึกษา B ได้
func RequireOwnership(fetchUserIDFunc func(*gin.Context) int) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(401, gin.H{"error": "ไม่พบข้อมูลผู้ใช้"})
			c.Abort()
			return
		}

		// ดึง user ID ของเจ้าของข้อมูล
		ownerID := fetchUserIDFunc(c)

		if userID.(int) != ownerID {
			c.JSON(403, gin.H{"error": "คุณไม่มีสิทธิ์เข้าถึงข้อมูลของผู้อื่น"})
			c.Abort()
			return
		}

		c.Next()
	}
}

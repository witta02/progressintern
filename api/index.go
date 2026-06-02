package handler

import (
	"net/http"
	"sync"

	"internship-backend/BackEnd/app"
	"internship-backend/BackEnd/config"
)

var (
	router http.Handler
	once   sync.Once
	err    error
)

func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(func() {
		err = config.InitDatabase()
		if err == nil {
			router = app.NewRouter()
		}
	})

	if err != nil {
		http.Error(w, "database connection failed", http.StatusServiceUnavailable)
		return
	}

	router.ServeHTTP(w, r)
}

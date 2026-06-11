package middleware

import (
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type ipLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	limit    int
	window   time.Duration
}

func newIPLimiter(limit int, window time.Duration) *ipLimiter {
	return &ipLimiter{
		attempts: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

func (l *ipLimiter) isAllowed(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-l.window)

	// Filter out old attempts
	var validAttempts []time.Time
	for _, t := range l.attempts[ip] {
		if t.After(cutoff) {
			validAttempts = append(validAttempts, t)
		}
	}

	if len(validAttempts) >= l.limit {
		l.attempts[ip] = validAttempts
		return false
	}

	validAttempts = append(validAttempts, now)
	l.attempts[ip] = validAttempts
	return true
}

// RateLimiter limits requests by client IP to limit requests per window duration
func RateLimiter(limit int, window time.Duration) gin.HandlerFunc {
	limiter := newIPLimiter(limit, window)
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !limiter.isAllowed(ip) {
			c.JSON(429, gin.H{
				"status": 429,
				"error":  "ส่งคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

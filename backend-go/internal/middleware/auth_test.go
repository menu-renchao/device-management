package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"device-management/internal/config"
	jwtpkg "device-management/pkg/jwt"

	"github.com/gin-gonic/gin"
)

func TestAuthAcceptsProxyCookieToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config.AppConfig = &config.Config{
		JWT: config.JWTConfig{
			SecretKey:           "test-secret",
			AccessTokenExpires:  time.Hour,
			RefreshTokenExpires: 24 * time.Hour,
		},
	}

	token, err := jwtpkg.GenerateAccessToken(42)
	if err != nil {
		t.Fatalf("GenerateAccessToken() error = %v", err)
	}

	router := gin.New()
	router.GET("/protected", Auth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.AddCookie(&http.Cookie{Name: "pos_proxy_token", Value: token})

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d body=%s", rec.Code, rec.Body.String())
	}
}

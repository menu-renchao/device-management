package services

import (
	"testing"
	"time"

	"device-management/internal/config"
	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openAuthServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func configureAuthServiceJWT(t *testing.T) {
	t.Helper()

	previous := config.AppConfig
	config.AppConfig = &config.Config{
		JWT: config.JWTConfig{
			SecretKey:           "test-secret",
			AccessTokenExpires:  time.Hour,
			RefreshTokenExpires: 24 * time.Hour,
		},
	}
	t.Cleanup(func() {
		config.AppConfig = previous
	})
}

func createApprovedAuthUser(t *testing.T, repo *repository.UserRepository, username string) *models.User {
	t.Helper()

	user := &models.User{
		Username: username,
		Role:     "user",
		Status:   "approved",
	}
	if err := user.SetPassword("password123"); err != nil {
		t.Fatalf("SetPassword() error = %v", err)
	}
	if err := repo.Create(user); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	return user
}

func TestAuthServiceRefreshReturnsNewTokenPair(t *testing.T) {
	configureAuthServiceJWT(t)

	db := openAuthServiceTestDB(t)
	repo := repository.NewUserRepository(db)
	service := NewAuthService(repo)
	createApprovedAuthUser(t, repo, "tester")

	loginResult, err := service.Login("tester", "password123")
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	refreshResult, err := service.Refresh(loginResult.RefreshToken)
	if err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}

	if refreshResult.AccessToken == "" {
		t.Fatalf("expected access token")
	}
	if refreshResult.RefreshToken == "" {
		t.Fatalf("expected refresh token")
	}
	if refreshResult.User == nil {
		t.Fatalf("expected user payload")
	}
}

func TestAuthServiceRefreshRejectsInvalidToken(t *testing.T) {
	configureAuthServiceJWT(t)

	db := openAuthServiceTestDB(t)
	repo := repository.NewUserRepository(db)
	service := NewAuthService(repo)

	if _, err := service.Refresh("invalid-refresh-token"); err == nil {
		t.Fatalf("expected refresh error")
	}
}

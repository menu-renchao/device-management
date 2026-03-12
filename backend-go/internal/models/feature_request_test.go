package models

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openFeatureRequestTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := db.AutoMigrate(&User{}, &FeatureRequest{}, &FeatureRequestLike{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	return db
}

func TestFeatureRequestDefaultsAndLikeUniqueIndex(t *testing.T) {
	db := openFeatureRequestTestDB(t)

	name := "Tester"
	email := "tester@example.com"
	user := &User{
		Username: "tester",
		PasswordHash: "x",
		Name: &name,
		Email: &email,
		Role: "user",
		Status: "approved",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	request := &FeatureRequest{
		Title: "Need faster sync",
		Content: "Please adapt sync for high-latency sites.",
		CreatedBy: user.ID,
	}
	if err := db.Create(request).Error; err != nil {
		t.Fatalf("create feature request: %v", err)
	}

	if request.Status != FeatureRequestStatusPending {
		t.Fatalf("status = %q, want %q", request.Status, FeatureRequestStatusPending)
	}
	if request.LikeCount != 0 {
		t.Fatalf("like_count = %d, want 0", request.LikeCount)
	}
	if request.CreatedAt.IsZero() || request.UpdatedAt.IsZero() {
		t.Fatalf("expected created_at and updated_at to be set")
	}

	like := &FeatureRequestLike{
		RequestID: request.ID,
		UserID: user.ID,
		CreatedAt: time.Now(),
	}
	if err := db.Create(like).Error; err != nil {
		t.Fatalf("create first like: %v", err)
	}

	duplicate := &FeatureRequestLike{
		RequestID: request.ID,
		UserID: user.ID,
		CreatedAt: time.Now(),
	}
	if err := db.Create(duplicate).Error; err == nil {
		t.Fatalf("expected duplicate like insert to fail")
	}
}

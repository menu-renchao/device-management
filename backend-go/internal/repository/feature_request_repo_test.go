package repository

import (
	"testing"
	"time"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openFeatureRequestRepoTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.FeatureRequest{}, &models.FeatureRequestLike{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func seedFeatureRequestUsers(t *testing.T, db *gorm.DB) (*models.User, *models.User) {
	t.Helper()

	userName := "Alice"
	userEmail := "alice@example.com"
	user := &models.User{
		Username:     "alice",
		PasswordHash: "x",
		Name:         &userName,
		Email:        &userEmail,
		Role:         "user",
		Status:       "approved",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	adminName := "Bob"
	adminEmail := "bob@example.com"
	admin := &models.User{
		Username:     "bob",
		PasswordHash: "x",
		Name:         &adminName,
		Email:        &adminEmail,
		Role:         "admin",
		Status:       "approved",
	}
	if err := db.Create(admin).Error; err != nil {
		t.Fatalf("create admin: %v", err)
	}

	return user, admin
}

func TestFeatureRequestRepositoryCreateAndList(t *testing.T) {
	db := openFeatureRequestRepoTestDB(t)
	repo := NewFeatureRequestRepository(db)
	user, _ := seedFeatureRequestUsers(t, db)

	first := &models.FeatureRequest{
		Title:     "Improve remote logs",
		Content:   "Need better filtering for noisy stores.",
		CreatedBy: user.ID,
	}
	if err := repo.Create(first); err != nil {
		t.Fatalf("Create(first) error: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	second := &models.FeatureRequest{
		Title:     "Add offline warning",
		Content:   "Show offline warning on scan table.",
		CreatedBy: user.ID,
		Status:    models.FeatureRequestStatusPlanned,
	}
	if err := repo.Create(second); err != nil {
		t.Fatalf("Create(second) error: %v", err)
	}

	latest, total, err := repo.List(FeatureRequestListOptions{
		Sort:     FeatureRequestSortLatest,
		Page:     1,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("List(latest) error: %v", err)
	}
	if total != 2 {
		t.Fatalf("total = %d, want 2", total)
	}
	if len(latest) != 2 {
		t.Fatalf("len(latest) = %d, want 2", len(latest))
	}
	if latest[0].ID != second.ID {
		t.Fatalf("expected latest result first, got ID %d", latest[0].ID)
	}

	filtered, filteredTotal, err := repo.List(FeatureRequestListOptions{
		Status:   models.FeatureRequestStatusPlanned,
		Sort:     FeatureRequestSortLatest,
		Page:     1,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("List(filtered) error: %v", err)
	}
	if filteredTotal != 1 {
		t.Fatalf("filtered total = %d, want 1", filteredTotal)
	}
	if len(filtered) != 1 || filtered[0].ID != second.ID {
		t.Fatalf("expected only planned request, got %+v", filtered)
	}
}

func TestFeatureRequestRepositoryAddLikeRemoveLikeAndHotSort(t *testing.T) {
	db := openFeatureRequestRepoTestDB(t)
	repo := NewFeatureRequestRepository(db)
	user, admin := seedFeatureRequestUsers(t, db)

	first := &models.FeatureRequest{
		Title:     "Keyboard shortcut support",
		Content:   "Need faster common actions.",
		CreatedBy: user.ID,
	}
	if err := repo.Create(first); err != nil {
		t.Fatalf("Create(first) error: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	second := &models.FeatureRequest{
		Title:     "More status badges",
		Content:   "Need more visible workflow states.",
		CreatedBy: admin.ID,
	}
	if err := repo.Create(second); err != nil {
		t.Fatalf("Create(second) error: %v", err)
	}

	if err := repo.AddLike(first.ID, user.ID); err != nil {
		t.Fatalf("AddLike(first, user) error: %v", err)
	}
	if err := repo.AddLike(first.ID, admin.ID); err != nil {
		t.Fatalf("AddLike(first, admin) error: %v", err)
	}
	if err := repo.AddLike(second.ID, user.ID); err != nil {
		t.Fatalf("AddLike(second, user) error: %v", err)
	}

	if err := repo.AddLike(first.ID, user.ID); err == nil {
		t.Fatalf("expected duplicate like to fail")
	}

	hot, total, err := repo.List(FeatureRequestListOptions{
		Sort:     FeatureRequestSortHot,
		Page:     1,
		PageSize: 10,
	})
	if err != nil {
		t.Fatalf("List(hot) error: %v", err)
	}
	if total != 2 {
		t.Fatalf("total = %d, want 2", total)
	}
	if len(hot) != 2 {
		t.Fatalf("len(hot) = %d, want 2", len(hot))
	}
	if hot[0].ID != first.ID {
		t.Fatalf("expected hot result first, got ID %d", hot[0].ID)
	}
	if hot[0].LikeCount != 2 {
		t.Fatalf("first like_count = %d, want 2", hot[0].LikeCount)
	}

	if err := repo.RemoveLike(first.ID, admin.ID); err != nil {
		t.Fatalf("RemoveLike(first, admin) error: %v", err)
	}
	if err := repo.RemoveLike(first.ID, admin.ID); err != nil {
		t.Fatalf("expected removing missing like to be idempotent, got %v", err)
	}

	updated, err := repo.GetByID(first.ID)
	if err != nil {
		t.Fatalf("GetByID(first) error: %v", err)
	}
	if updated.LikeCount != 1 {
		t.Fatalf("updated like_count = %d, want 1", updated.LikeCount)
	}
}

func TestFeatureRequestRepositoryUpdateStatus(t *testing.T) {
	db := openFeatureRequestRepoTestDB(t)
	repo := NewFeatureRequestRepository(db)
	user, _ := seedFeatureRequestUsers(t, db)

	request := &models.FeatureRequest{
		Title:     "License backup reminders",
		Content:   "Need clearer reminder before risky operations.",
		CreatedBy: user.ID,
	}
	if err := repo.Create(request); err != nil {
		t.Fatalf("Create(request) error: %v", err)
	}

	if err := repo.UpdateStatus(request.ID, models.FeatureRequestStatusCompleted); err != nil {
		t.Fatalf("UpdateStatus error: %v", err)
	}

	updated, err := repo.GetByID(request.ID)
	if err != nil {
		t.Fatalf("GetByID error: %v", err)
	}
	if updated.Status != models.FeatureRequestStatusCompleted {
		t.Fatalf("status = %q, want %q", updated.Status, models.FeatureRequestStatusCompleted)
	}
}

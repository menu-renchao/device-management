package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"device-management/internal/middleware"
	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openFeatureRequestHandlerTestDB(t *testing.T) *gorm.DB {
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

func seedFeatureRequestHandlerUsers(t *testing.T, db *gorm.DB) (*models.User, *models.User) {
	t.Helper()

	userName := "Normal User"
	userEmail := "user@example.com"
	user := &models.User{
		ID:           1,
		Username:     "user",
		PasswordHash: "x",
		Name:         &userName,
		Email:        &userEmail,
		Role:         "user",
		Status:       "approved",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	adminName := "Admin User"
	adminEmail := "admin@example.com"
	admin := &models.User{
		ID:           2,
		Username:     "admin",
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

func newFeatureRequestHandlerForTest(t *testing.T) (*FeatureRequestHandler, *repository.UserRepository, *repository.FeatureRequestRepository) {
	t.Helper()

	db := openFeatureRequestHandlerTestDB(t)
	userRepo := repository.NewUserRepository(db)
	featureRepo := repository.NewFeatureRequestRepository(db)
	seedFeatureRequestHandlerUsers(t, db)

	return NewFeatureRequestHandler(featureRepo, userRepo), userRepo, featureRepo
}

func TestFeatureRequestCreateAndList(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler, _, repo := newFeatureRequestHandlerForTest(t)

	existing := &models.FeatureRequest{
		Title:     "Need faster borrow approvals",
		Content:   "Hot stores need a more direct approval flow.",
		CreatedBy: 2,
	}
	if err := repo.Create(existing); err != nil {
		t.Fatalf("seed request: %v", err)
	}

	router := gin.New()
	router.POST("/feature-requests", withUser(1, handler.Create))
	router.GET("/feature-requests", withUser(1, handler.List))

	body, _ := json.Marshal(map[string]string{
		"title":   "Need idea board",
		"content": "Expose product feedback to all logged-in users.",
	})
	createReq := httptest.NewRequest(http.MethodPost, "/feature-requests", bytes.NewReader(body))
	createReq.Header.Set("Content-Type", "application/json")
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("create status = %d, want %d, body = %s", createRec.Code, http.StatusCreated, createRec.Body.String())
	}
	if !bytes.Contains(createRec.Body.Bytes(), []byte(`"Need idea board"`)) {
		t.Fatalf("expected created request in response: %s", createRec.Body.String())
	}

	listReq := httptest.NewRequest(http.MethodGet, "/feature-requests?sort=latest", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("list status = %d, want %d, body = %s", listRec.Code, http.StatusOK, listRec.Body.String())
	}
	if !bytes.Contains(listRec.Body.Bytes(), []byte(`"liked_by_me":false`)) {
		t.Fatalf("expected liked_by_me field in list response: %s", listRec.Body.String())
	}
	if !bytes.Contains(listRec.Body.Bytes(), []byte(`"Normal User"`)) {
		t.Fatalf("expected author name in list response: %s", listRec.Body.String())
	}
}

func TestFeatureRequestLikeAndUnlike(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler, _, repo := newFeatureRequestHandlerForTest(t)
	request := &models.FeatureRequest{
		Title:     "Need ranking board",
		Content:   "Sort requests by likes.",
		CreatedBy: 2,
	}
	if err := repo.Create(request); err != nil {
		t.Fatalf("seed request: %v", err)
	}

	router := gin.New()
	router.POST("/feature-requests/:id/like", withUser(1, handler.Like))
	router.DELETE("/feature-requests/:id/like", withUser(1, handler.Unlike))

	likeReq := httptest.NewRequest(http.MethodPost, "/feature-requests/1/like", nil)
	likeRec := httptest.NewRecorder()
	router.ServeHTTP(likeRec, likeReq)

	if likeRec.Code != http.StatusOK {
		t.Fatalf("like status = %d, want %d, body = %s", likeRec.Code, http.StatusOK, likeRec.Body.String())
	}

	unlikeReq := httptest.NewRequest(http.MethodDelete, "/feature-requests/1/like", nil)
	unlikeRec := httptest.NewRecorder()
	router.ServeHTTP(unlikeRec, unlikeReq)

	if unlikeRec.Code != http.StatusOK {
		t.Fatalf("unlike status = %d, want %d, body = %s", unlikeRec.Code, http.StatusOK, unlikeRec.Body.String())
	}
}

func TestFeatureRequestStatusRequiresAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler, userRepo, repo := newFeatureRequestHandlerForTest(t)
	request := &models.FeatureRequest{
		Title:     "Need feedback status",
		Content:   "Admins should update states.",
		CreatedBy: 1,
	}
	if err := repo.Create(request); err != nil {
		t.Fatalf("seed request: %v", err)
	}

	router := gin.New()
	router.PUT("/feature-requests/:id/status", withUser(1, middleware.AdminOnly(userRepo), handler.UpdateStatus))

	body, _ := json.Marshal(map[string]string{"status": models.FeatureRequestStatusPlanned})
	req := httptest.NewRequest(http.MethodPut, "/feature-requests/1/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusForbidden, rec.Body.String())
	}
}

func TestFeatureRequestStatusAdminCanUpdate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler, userRepo, repo := newFeatureRequestHandlerForTest(t)
	request := &models.FeatureRequest{
		Title:     "Need done marker",
		Content:   "Show when a request is completed.",
		CreatedBy: 1,
	}
	if err := repo.Create(request); err != nil {
		t.Fatalf("seed request: %v", err)
	}

	router := gin.New()
	router.PUT("/feature-requests/:id/status", withUser(2, middleware.AdminOnly(userRepo), handler.UpdateStatus))

	body, _ := json.Marshal(map[string]string{"status": models.FeatureRequestStatusCompleted})
	req := httptest.NewRequest(http.MethodPut, "/feature-requests/1/status", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(models.FeatureRequestStatusCompleted)) {
		t.Fatalf("expected completed status in response: %s", rec.Body.String())
	}
}

func withUser(userID uint, middlewares ...gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("user_id", userID)
		for _, m := range middlewares {
			m(c)
			if c.IsAborted() {
				return
			}
		}
	}
}

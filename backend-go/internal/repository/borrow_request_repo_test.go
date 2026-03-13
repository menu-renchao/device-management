package repository

import (
	"testing"
	"time"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openBorrowRequestRepoTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.ScanResult{},
		&models.MobileDevice{},
		&models.BorrowRequest{},
	); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func seedBorrowRequestRepoUsers(t *testing.T, db *gorm.DB) (*models.User, *models.User) {
	t.Helper()

	requesterName := "Requester"
	requesterEmail := "requester@example.com"
	requester := &models.User{
		Username:     "requester",
		PasswordHash: "x",
		Name:         &requesterName,
		Email:        &requesterEmail,
		Role:         "user",
		Status:       "approved",
	}
	if err := db.Create(requester).Error; err != nil {
		t.Fatalf("create requester: %v", err)
	}

	ownerName := "Owner"
	ownerEmail := "owner@example.com"
	owner := &models.User{
		Username:     "owner",
		PasswordHash: "x",
		Name:         &ownerName,
		Email:        &ownerEmail,
		Role:         "user",
		Status:       "approved",
	}
	if err := db.Create(owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}

	return requester, owner
}

func TestBorrowRequestRepositoryCreateAndListByAssetType(t *testing.T) {
	db := openBorrowRequestRepoTestDB(t)
	repo := NewBorrowRequestRepository(db)
	requester, owner := seedBorrowRequestRepoUsers(t, db)

	merchantID := "M100"
	name := "POS-1"
	deviceType := "linux"
	scanResult := &models.ScanResult{
		IP:             "10.0.0.1",
		MerchantID:     &merchantID,
		Name:           &name,
		Type:           &deviceType,
		ScannedAt:      time.Now(),
		IsOnline:       true,
		LastOnlineTime: time.Now(),
		OwnerID:        &owner.ID,
	}
	if err := db.Create(scanResult).Error; err != nil {
		t.Fatalf("create scan result: %v", err)
	}

	req := &models.BorrowRequest{
		AssetType:      models.BorrowAssetTypePOS,
		MerchantID:     &merchantID,
		RequesterID:    requester.ID,
		ApproverUserID: &owner.ID,
		Status:         models.BorrowRequestStatusPending,
		Purpose:        "store support",
		EndTime:        time.Now().Add(2 * time.Hour),
	}

	if err := repo.Create(req); err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	items, err := repo.List(BorrowRequestListOptions{
		Status:    models.BorrowRequestStatusPending,
		AssetType: models.BorrowAssetTypePOS,
	})
	if err != nil {
		t.Fatalf("List returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len(items) = %d, want 1", len(items))
	}
	if items[0].AssetType != models.BorrowAssetTypePOS {
		t.Fatalf("AssetType = %q, want %q", items[0].AssetType, models.BorrowAssetTypePOS)
	}
	if items[0].MerchantID == nil || *items[0].MerchantID != merchantID {
		t.Fatalf("MerchantID = %v, want %q", items[0].MerchantID, merchantID)
	}
}

func TestBorrowRequestRepositoryListByRequesterReturnsPOSAndMobile(t *testing.T) {
	db := openBorrowRequestRepoTestDB(t)
	repo := NewBorrowRequestRepository(db)
	requester, owner := seedBorrowRequestRepoUsers(t, db)

	merchantID := "M200"
	name := "POS-2"
	deviceType := "linux"
	scanResult := &models.ScanResult{
		IP:             "10.0.0.2",
		MerchantID:     &merchantID,
		Name:           &name,
		Type:           &deviceType,
		ScannedAt:      time.Now(),
		IsOnline:       true,
		LastOnlineTime: time.Now(),
		OwnerID:        &owner.ID,
	}
	if err := db.Create(scanResult).Error; err != nil {
		t.Fatalf("create scan result: %v", err)
	}

	mobileDevice := &models.MobileDevice{
		Name:    "iPad-1",
		OwnerID: &owner.ID,
	}
	if err := db.Create(mobileDevice).Error; err != nil {
		t.Fatalf("create mobile device: %v", err)
	}

	posRequest := &models.BorrowRequest{
		AssetType:      models.BorrowAssetTypePOS,
		MerchantID:     &merchantID,
		RequesterID:    requester.ID,
		ApproverUserID: &owner.ID,
		Purpose:        "pos request",
		EndTime:        time.Now().Add(3 * time.Hour),
		Status:         models.BorrowRequestStatusPending,
	}
	if err := db.Create(posRequest).Error; err != nil {
		t.Fatalf("create pos borrow request: %v", err)
	}

	mobileRequest := &models.BorrowRequest{
		AssetType:      models.BorrowAssetTypeMobile,
		AssetID:        &mobileDevice.ID,
		RequesterID:    requester.ID,
		ApproverUserID: &owner.ID,
		Purpose:        "mobile request",
		EndTime:        time.Now().Add(4 * time.Hour),
		Status:         models.BorrowRequestStatusApproved,
	}
	if err := db.Create(mobileRequest).Error; err != nil {
		t.Fatalf("create unified mobile borrow request: %v", err)
	}

	items, err := repo.ListByRequester(requester.ID)
	if err != nil {
		t.Fatalf("ListByRequester returned error: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(items))
	}

	foundPOS := false
	foundMobile := false
	for _, item := range items {
		switch item.AssetType {
		case models.BorrowAssetTypePOS:
			foundPOS = true
			if item.MerchantID == nil || *item.MerchantID != merchantID {
				t.Fatalf("migrated pos MerchantID = %v, want %q", item.MerchantID, merchantID)
			}
		case models.BorrowAssetTypeMobile:
			foundMobile = true
			if item.AssetID == nil || *item.AssetID != mobileDevice.ID {
				t.Fatalf("migrated mobile AssetID = %v, want %d", item.AssetID, mobileDevice.ID)
			}
		}
	}

	if !foundPOS {
		t.Fatalf("expected POS borrow request")
	}
	if !foundMobile {
		t.Fatalf("expected mobile borrow request")
	}
}

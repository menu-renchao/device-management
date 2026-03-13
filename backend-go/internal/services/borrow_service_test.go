package services

import (
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openBorrowServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.ScanResult{},
		&models.DeviceOccupancy{},
		&models.MobileDevice{},
		&models.BorrowRequest{},
	); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func seedBorrowServiceUsers(t *testing.T, db *gorm.DB) (admin, owner, requester *models.User) {
	t.Helper()

	createUser := func(username, role string) *models.User {
		name := username
		email := username + "@example.com"
		user := &models.User{
			Username:     username,
			PasswordHash: "x",
			Name:         &name,
			Email:        &email,
			Role:         role,
			Status:       "approved",
		}
		if err := db.Create(user).Error; err != nil {
			t.Fatalf("create user %s: %v", username, err)
		}
		return user
	}

	return createUser("admin", "admin"),
		createUser("owner", "user"),
		createUser("requester", "user")
}

func TestBorrowServiceSubmitAndApprovePOSRequest(t *testing.T) {
	db := openBorrowServiceTestDB(t)
	admin, owner, requester := seedBorrowServiceUsers(t, db)

	merchantID := "M400"
	name := "POS-400"
	deviceType := "linux"
	scanResult := &models.ScanResult{
		IP:             "10.0.4.0",
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

	service := NewBorrowService(
		repository.NewBorrowRequestRepository(db),
		repository.NewDeviceRepository(db),
		repository.NewMobileRepository(db),
		repository.NewUserRepository(db),
		NewAssetAccessService(
			repository.NewUserRepository(db),
			repository.NewDeviceRepository(db),
			repository.NewMobileRepository(db),
		),
	)

	req, err := service.Submit(BorrowSubmitInput{
		AssetType:   models.BorrowAssetTypePOS,
		MerchantID:  merchantID,
		RequesterID: requester.ID,
		Purpose:     "temporary support",
		EndTime:     time.Now().Add(4 * time.Hour),
	})
	if err != nil {
		t.Fatalf("Submit returned error: %v", err)
	}
	if req.ApproverUserID == nil || *req.ApproverUserID != owner.ID {
		t.Fatalf("ApproverUserID = %v, want %d", req.ApproverUserID, owner.ID)
	}

	approved, err := service.Approve(req.ID, admin.ID)
	if err != nil {
		t.Fatalf("Approve returned error: %v", err)
	}
	if approved.Status != models.BorrowRequestStatusApproved {
		t.Fatalf("Status = %q, want %q", approved.Status, models.BorrowRequestStatusApproved)
	}

	occupancy, err := repository.NewDeviceRepository(db).GetOccupancyByMerchantID(merchantID)
	if err != nil {
		t.Fatalf("GetOccupancyByMerchantID returned error: %v", err)
	}
	if occupancy.UserID != requester.ID {
		t.Fatalf("occupancy.UserID = %d, want %d", occupancy.UserID, requester.ID)
	}
}

func TestBorrowServiceSubmitAndRejectMobileRequest(t *testing.T) {
	db := openBorrowServiceTestDB(t)
	admin, owner, requester := seedBorrowServiceUsers(t, db)

	device := &models.MobileDevice{
		Name:    "iPad-400",
		OwnerID: &owner.ID,
	}
	if err := db.Create(device).Error; err != nil {
		t.Fatalf("create mobile device: %v", err)
	}

	service := NewBorrowService(
		repository.NewBorrowRequestRepository(db),
		repository.NewDeviceRepository(db),
		repository.NewMobileRepository(db),
		repository.NewUserRepository(db),
		NewAssetAccessService(
			repository.NewUserRepository(db),
			repository.NewDeviceRepository(db),
			repository.NewMobileRepository(db),
		),
	)

	req, err := service.Submit(BorrowSubmitInput{
		AssetType:   models.BorrowAssetTypeMobile,
		AssetID:     device.ID,
		RequesterID: requester.ID,
		Purpose:     "field repair",
		EndTime:     time.Now().Add(6 * time.Hour),
	})
	if err != nil {
		t.Fatalf("Submit returned error: %v", err)
	}

	rejected, err := service.Reject(req.ID, admin.ID, "busy")
	if err != nil {
		t.Fatalf("Reject returned error: %v", err)
	}
	if rejected.Status != models.BorrowRequestStatusRejected {
		t.Fatalf("Status = %q, want %q", rejected.Status, models.BorrowRequestStatusRejected)
	}
	if rejected.RejectionReason == nil || *rejected.RejectionReason != "busy" {
		t.Fatalf("RejectionReason = %v, want busy", rejected.RejectionReason)
	}

	updatedDevice, err := repository.NewMobileRepository(db).GetByID(device.ID)
	if err != nil {
		t.Fatalf("GetByID returned error: %v", err)
	}
	if updatedDevice.OccupierID != nil {
		t.Fatalf("expected rejected request not to occupy device")
	}
}

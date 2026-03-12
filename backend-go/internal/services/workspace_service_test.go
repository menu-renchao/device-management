package services

import (
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openWorkspaceServiceTestDB(t *testing.T) *gorm.DB {
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

func seedWorkspaceUsers(t *testing.T, db *gorm.DB) (owner, requester *models.User) {
	t.Helper()

	createUser := func(username string) *models.User {
		name := username
		email := username + "@example.com"
		user := &models.User{
			Username:     username,
			PasswordHash: "x",
			Name:         &name,
			Email:        &email,
			Role:         "user",
			Status:       "approved",
		}
		if err := db.Create(user).Error; err != nil {
			t.Fatalf("create user %s: %v", username, err)
		}
		return user
	}

	return createUser("owner"), createUser("requester")
}

func TestWorkspaceServiceGetMyDevicesUsesUnifiedBorrowRequests(t *testing.T) {
	db := openWorkspaceServiceTestDB(t)
	owner, requester := seedWorkspaceUsers(t, db)

	merchantID := "M700"
	posName := "POS-700"
	deviceType := "linux"
	pos := &models.ScanResult{
		IP:             "10.7.0.1",
		MerchantID:     &merchantID,
		Name:           &posName,
		Type:           &deviceType,
		ScannedAt:      time.Now(),
		IsOnline:       true,
		LastOnlineTime: time.Now(),
		OwnerID:        &owner.ID,
	}
	if err := db.Create(pos).Error; err != nil {
		t.Fatalf("create pos: %v", err)
	}

	purpose := "night support"
	occupancy := &models.DeviceOccupancy{
		MerchantID: merchantID,
		UserID:     requester.ID,
		Purpose:    &purpose,
		StartTime:  time.Now().Add(-time.Hour),
		EndTime:    time.Now().Add(2 * time.Hour),
	}
	if err := db.Create(occupancy).Error; err != nil {
		t.Fatalf("create occupancy: %v", err)
	}

	mobilePurpose := "field repair"
	startTime := time.Now().Add(-30 * time.Minute)
	endTime := time.Now().Add(3 * time.Hour)
	mobile := &models.MobileDevice{
		Name:       "iPad-700",
		OwnerID:    &owner.ID,
		OccupierID: &requester.ID,
		Purpose:    &mobilePurpose,
		StartTime:  &startTime,
		EndTime:    &endTime,
	}
	if err := db.Create(mobile).Error; err != nil {
		t.Fatalf("create mobile device: %v", err)
	}

	if err := db.Create(&models.BorrowRequest{
		AssetType:      models.BorrowAssetTypePOS,
		MerchantID:     &merchantID,
		RequesterID:    requester.ID,
		ApproverUserID: &owner.ID,
		Status:         models.BorrowRequestStatusPending,
		Purpose:        "borrow pos",
		EndTime:        time.Now().Add(4 * time.Hour),
	}).Error; err != nil {
		t.Fatalf("create pos borrow request: %v", err)
	}

	if err := db.Create(&models.BorrowRequest{
		AssetType:      models.BorrowAssetTypeMobile,
		AssetID:        &mobile.ID,
		RequesterID:    requester.ID,
		ApproverUserID: &owner.ID,
		Status:         models.BorrowRequestStatusPending,
		Purpose:        "borrow mobile",
		EndTime:        time.Now().Add(5 * time.Hour),
	}).Error; err != nil {
		t.Fatalf("create mobile borrow request: %v", err)
	}

	service := NewWorkspaceService(
		repository.NewBorrowRequestRepository(db),
		repository.NewDeviceRepository(db),
		repository.NewMobileRepository(db),
		repository.NewUserRepository(db),
	)

	result, err := service.GetMyDevices(owner.ID)
	if err != nil {
		t.Fatalf("GetMyDevices returned error: %v", err)
	}

	if len(result.PosDevices) != 1 || result.PosDevices[0]["pendingBorrowCount"] != 1 {
		t.Fatalf("unexpected pos devices result: %+v", result.PosDevices)
	}
	if len(result.MobileDevices) != 1 || result.MobileDevices[0]["pendingBorrowCount"] != 1 {
		t.Fatalf("unexpected mobile devices result: %+v", result.MobileDevices)
	}
	if len(result.Devices) != 2 {
		t.Fatalf("Devices length = %d, want 2", len(result.Devices))
	}
}

func TestWorkspaceServiceGetMyBorrowsReturnsUnifiedAndSplitData(t *testing.T) {
	db := openWorkspaceServiceTestDB(t)
	owner, requester := seedWorkspaceUsers(t, db)

	merchantID := "M701"
	posName := "POS-701"
	deviceType := "linux"
	if err := db.Create(&models.ScanResult{
		IP:             "10.7.0.2",
		MerchantID:     &merchantID,
		Name:           &posName,
		Type:           &deviceType,
		ScannedAt:      time.Now(),
		IsOnline:       true,
		LastOnlineTime: time.Now(),
		OwnerID:        &owner.ID,
	}).Error; err != nil {
		t.Fatalf("create pos: %v", err)
	}

	posPurpose := "temporary swap"
	if err := db.Create(&models.DeviceOccupancy{
		MerchantID: merchantID,
		UserID:     requester.ID,
		Purpose:    &posPurpose,
		StartTime:  time.Now().Add(-time.Hour),
		EndTime:    time.Now().Add(90 * time.Minute),
	}).Error; err != nil {
		t.Fatalf("create occupancy: %v", err)
	}

	mobilePurpose := "mobile test"
	startTime := time.Now().Add(-45 * time.Minute)
	endTime := time.Now().Add(2 * time.Hour)
	mobile := &models.MobileDevice{
		Name:       "iPad-701",
		OwnerID:    &owner.ID,
		OccupierID: &requester.ID,
		Purpose:    &mobilePurpose,
		StartTime:  &startTime,
		EndTime:    &endTime,
	}
	if err := db.Create(mobile).Error; err != nil {
		t.Fatalf("create mobile: %v", err)
	}

	service := NewWorkspaceService(
		repository.NewBorrowRequestRepository(db),
		repository.NewDeviceRepository(db),
		repository.NewMobileRepository(db),
		repository.NewUserRepository(db),
	)

	result, err := service.GetMyBorrows(requester.ID)
	if err != nil {
		t.Fatalf("GetMyBorrows returned error: %v", err)
	}

	if len(result.PosBorrows) != 1 {
		t.Fatalf("PosBorrows length = %d, want 1", len(result.PosBorrows))
	}
	if len(result.MobileBorrows) != 1 {
		t.Fatalf("MobileBorrows length = %d, want 1", len(result.MobileBorrows))
	}
	if len(result.Borrows) != 2 {
		t.Fatalf("Borrows length = %d, want 2", len(result.Borrows))
	}
}

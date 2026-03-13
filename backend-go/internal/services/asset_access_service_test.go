package services

import (
	"testing"
	"time"

	"device-management/internal/models"
	"device-management/internal/repository"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func openAssetAccessTestDB(t *testing.T) *gorm.DB {
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
	); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func seedAssetAccessUsers(t *testing.T, db *gorm.DB) (admin, owner, occupier, other *models.User) {
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

	return createUser("admin-user", "admin"),
		createUser("owner-user", "user"),
		createUser("occupier-user", "user"),
		createUser("other-user", "user")
}

func TestAssetAccessServiceAllowsAdminOwnerAndOccupierForPOSRead(t *testing.T) {
	db := openAssetAccessTestDB(t)
	admin, owner, occupier, other := seedAssetAccessUsers(t, db)

	merchantID := "M300"
	name := "POS-300"
	deviceType := "linux"
	scanResult := &models.ScanResult{
		IP:             "10.0.3.0",
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

	occupancy := &models.DeviceOccupancy{
		MerchantID: merchantID,
		UserID:     occupier.ID,
		StartTime:  time.Now().Add(-time.Hour),
		EndTime:    time.Now().Add(time.Hour),
	}
	if err := db.Create(occupancy).Error; err != nil {
		t.Fatalf("create occupancy: %v", err)
	}

	service := NewAssetAccessService(
		repository.NewUserRepository(db),
		repository.NewDeviceRepository(db),
		repository.NewMobileRepository(db),
	)

	scope := AssetScope{AssetType: models.BorrowAssetTypePOS, MerchantID: merchantID}

	adminAllowed, err := service.CanAccess(admin.ID, scope, ActionLinuxRead)
	if err != nil {
		t.Fatalf("admin CanAccess returned error: %v", err)
	}
	if !adminAllowed {
		t.Fatalf("expected admin to have access")
	}

	ownerAllowed, err := service.CanAccess(owner.ID, scope, ActionLinuxRead)
	if err != nil {
		t.Fatalf("owner CanAccess returned error: %v", err)
	}
	if !ownerAllowed {
		t.Fatalf("expected owner to have access")
	}

	occupierAllowed, err := service.CanAccess(occupier.ID, scope, ActionLinuxRead)
	if err != nil {
		t.Fatalf("occupier CanAccess returned error: %v", err)
	}
	if !occupierAllowed {
		t.Fatalf("expected occupier to have access")
	}

	otherAllowed, err := service.CanAccess(other.ID, scope, ActionLinuxRead)
	if err != nil {
		t.Fatalf("other CanAccess returned error: %v", err)
	}
	if otherAllowed {
		t.Fatalf("expected unrelated user to be denied")
	}
}

func TestAssetAccessServiceRestrictsBorrowApprovalToAdminAndOwner(t *testing.T) {
	db := openAssetAccessTestDB(t)
	admin, owner, occupier, other := seedAssetAccessUsers(t, db)

	device := &models.MobileDevice{
		Name:       "iPad-2",
		OwnerID:    &owner.ID,
		OccupierID: &occupier.ID,
	}
	endTime := time.Now().Add(time.Hour)
	startTime := time.Now().Add(-time.Hour)
	device.StartTime = &startTime
	device.EndTime = &endTime
	if err := db.Create(device).Error; err != nil {
		t.Fatalf("create mobile device: %v", err)
	}

	service := NewAssetAccessService(
		repository.NewUserRepository(db),
		repository.NewDeviceRepository(db),
		repository.NewMobileRepository(db),
	)

	scope := AssetScope{AssetType: models.BorrowAssetTypeMobile, AssetID: device.ID}

	adminAllowed, err := service.CanAccess(admin.ID, scope, ActionBorrowApprove)
	if err != nil {
		t.Fatalf("admin CanAccess returned error: %v", err)
	}
	if !adminAllowed {
		t.Fatalf("expected admin to approve")
	}

	ownerAllowed, err := service.CanAccess(owner.ID, scope, ActionBorrowApprove)
	if err != nil {
		t.Fatalf("owner CanAccess returned error: %v", err)
	}
	if !ownerAllowed {
		t.Fatalf("expected owner to approve")
	}

	occupierAllowed, err := service.CanAccess(occupier.ID, scope, ActionBorrowApprove)
	if err != nil {
		t.Fatalf("occupier CanAccess returned error: %v", err)
	}
	if occupierAllowed {
		t.Fatalf("expected occupier to be denied borrow approval")
	}

	otherAllowed, err := service.CanAccess(other.ID, scope, ActionBorrowApprove)
	if err != nil {
		t.Fatalf("other CanAccess returned error: %v", err)
	}
	if otherAllowed {
		t.Fatalf("expected unrelated user to be denied")
	}
}

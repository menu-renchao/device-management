package main

import (
	"os"
	"strings"
	"testing"
)

func TestLegacyBorrowRoutesRemoved(t *testing.T) {
	contentBytes, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}

	content := string(contentBytes)
	legacyRoutes := []string{
		`device.POST("/borrow-requests", deviceHandler.SubmitBorrowRequest)`,
		`device.GET("/borrow-requests", deviceHandler.GetBorrowRequests)`,
		`device.POST("/borrow-requests/:id/approve", deviceHandler.ApproveBorrowRequest)`,
		`device.POST("/borrow-requests/:id/reject", deviceHandler.RejectBorrowRequest)`,
		`mobile.POST("/borrow-requests", mobileHandler.SubmitBorrowRequest)`,
		`mobile.GET("/borrow-requests", mobileHandler.GetBorrowRequests)`,
		`mobile.POST("/borrow-requests/:id/approve", mobileHandler.ApproveBorrowRequest)`,
		`mobile.POST("/borrow-requests/:id/reject", mobileHandler.RejectBorrowRequest)`,
	}

	for _, route := range legacyRoutes {
		if strings.Contains(content, route) {
			t.Fatalf("legacy borrow route still registered: %s", route)
		}
	}
}

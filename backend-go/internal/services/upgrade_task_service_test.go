package services

import (
	"testing"
	"time"
)

func TestCreateDirectUpgradeTaskStepOrder(t *testing.T) {
	manager := NewUpgradeTaskManager()

	task := manager.CreateDirectUpgradeTask("M123", "server")

	if len(task.Steps) != 5 {
		t.Fatalf("expected 5 steps, got %d", len(task.Steps))
	}

	if task.Steps[0].Name != "停止 POS 服务" {
		t.Fatalf("expected first step to stop POS, got %q", task.Steps[0].Name)
	}

	if task.Steps[1].Name != "上传/复制 WAR 包" {
		t.Fatalf("expected second step to upload/copy WAR, got %q", task.Steps[1].Name)
	}
}

func TestCreatePackageUpgradeTaskStepOrder(t *testing.T) {
	manager := NewUpgradeTaskManager()

	task := manager.CreatePackageUpgradeTask("M123", "server")

	if len(task.Steps) != 5 {
		t.Fatalf("expected 5 steps, got %d", len(task.Steps))
	}

	if task.Steps[0].Name != "停止 POS 服务" {
		t.Fatalf("expected first step to stop POS, got %q", task.Steps[0].Name)
	}

	if task.Steps[1].Name != "复制/上传 WAR 包" {
		t.Fatalf("expected second step to copy/upload WAR, got %q", task.Steps[1].Name)
	}
}

func TestLocalUpgradeTaskAcceptsBrowserUpload(t *testing.T) {
	manager := NewUpgradeTaskManager()

	task := manager.CreateDirectUpgradeTask("M123", "local")

	done := make(chan string, 1)
	go func() {
		path, err := task.WaitForLocalUpload(2 * time.Second)
		if err != nil {
			done <- "error:" + err.Error()
			return
		}
		done <- path
	}()

	if err := task.AttachLocalUpload("C:/tmp/kpos.war"); err != nil {
		t.Fatalf("expected attach upload to succeed, got %v", err)
	}

	select {
	case result := <-done:
		if result != "C:/tmp/kpos.war" {
			t.Fatalf("expected upload path to round trip, got %q", result)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for local upload")
	}
}

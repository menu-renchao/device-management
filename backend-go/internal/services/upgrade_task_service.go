package services

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// UpgradeStep 单个升级步骤
type UpgradeStep struct {
	Name     string `json:"name"`
	Status   string `json:"status"` // "pending", "running", "completed", "failed"
	Message  string `json:"message"`
	Progress int    `json:"progress"` // 步骤内进度 0-100
}

// UpgradeTask 升级任务
type UpgradeTask struct {
	ID          string        `json:"id"`
	MerchantID  string        `json:"merchant_id"`
	Type        string        `json:"type"` // "direct" | "package"
	SourceType  string        `json:"source_type"`
	Status      string        `json:"status"` // "pending", "running", "completed", "failed"
	Progress    int           `json:"progress"` // 总进度 0-100
	Message     string        `json:"message"`
	Steps       []UpgradeStep `json:"steps"`
	CurrentStep int           `json:"current_step"`
	Error       string        `json:"error,omitempty"`
	StartTime   time.Time     `json:"start_time"`
	EndTime     *time.Time    `json:"end_time,omitempty"`
	eventChan   chan UpgradeEvent
	localUpload chan string
	mu          sync.RWMutex
}

// UpgradeEvent 升级事件
type UpgradeEvent struct {
	Type    string      `json:"type"` // "progress", "step", "completed", "error"
	Payload interface{} `json:"payload"`
}

// UpgradeTaskSnapshot 任务快照（用于 JSON 序列化）
type UpgradeTaskSnapshot struct {
	ID          string        `json:"id"`
	MerchantID  string        `json:"merchant_id"`
	Type        string        `json:"type"`
	SourceType  string        `json:"source_type"`
	Status      string        `json:"status"`
	Progress    int           `json:"progress"`
	Message     string        `json:"message"`
	Steps       []UpgradeStep `json:"steps"`
	CurrentStep int           `json:"current_step"`
	Error       string        `json:"error,omitempty"`
	StartTime   time.Time     `json:"start_time"`
	EndTime     *time.Time    `json:"end_time,omitempty"`
}

// ToSnapshot 获取任务快照（对外公开，自行加读锁）
func (t *UpgradeTask) ToSnapshot() *UpgradeTaskSnapshot {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.toSnapshotLocked()
}

// toSnapshotLocked 获取任务快照（调用方必须已持有锁）
func (t *UpgradeTask) toSnapshotLocked() *UpgradeTaskSnapshot {
	stepsCopy := make([]UpgradeStep, len(t.Steps))
	copy(stepsCopy, t.Steps)
	return &UpgradeTaskSnapshot{
		ID:          t.ID,
		MerchantID:  t.MerchantID,
		Type:        t.Type,
		SourceType:  t.SourceType,
		Status:      t.Status,
		Progress:    t.Progress,
		Message:     t.Message,
		Steps:       stepsCopy,
		CurrentStep: t.CurrentStep,
		Error:       t.Error,
		StartTime:   t.StartTime,
		EndTime:     t.EndTime,
	}
}

// UpgradeTaskManager 升级任务管理器
type UpgradeTaskManager struct {
	tasks map[string]*UpgradeTask
	mu    sync.RWMutex
}

// NewUpgradeTaskManager 创建任务管理器
func NewUpgradeTaskManager() *UpgradeTaskManager {
	return &UpgradeTaskManager{
		tasks: make(map[string]*UpgradeTask),
	}
}

// CreateDirectUpgradeTask 创建直接替换 WAR 升级任务
func (m *UpgradeTaskManager) CreateDirectUpgradeTask(merchantID, sourceType string) *UpgradeTask {
	if sourceType == "" {
		sourceType = "server"
	}

	task := &UpgradeTask{
		ID:         uuid.New().String(),
		MerchantID: merchantID,
		Type:       "direct",
		SourceType: sourceType,
		Status:     "pending",
		Progress:   0,
		Message:    "准备升级",
		StartTime:  time.Now(),
		eventChan:  make(chan UpgradeEvent, 100),
		Steps: []UpgradeStep{
			{Name: "停止 POS 服务", Status: "pending", Progress: 0},
			{Name: "上传/复制 WAR 包", Status: "pending", Progress: 0},
			{Name: "解压 WAR 包", Status: "pending", Progress: 0},
			{Name: "执行配置修改", Status: "pending", Progress: 0},
			{Name: "重启 POS 服务", Status: "pending", Progress: 0},
		},
		CurrentStep: 0,
	}
	if sourceType == "local" {
		task.localUpload = make(chan string, 1)
	}

	m.mu.Lock()
	m.tasks[task.ID] = task
	m.mu.Unlock()

	return task
}

// CreatePackageUpgradeTask 创建升级包升级任务
func (m *UpgradeTaskManager) CreatePackageUpgradeTask(merchantID, sourceType string) *UpgradeTask {
	if sourceType == "" {
		sourceType = "server"
	}

	task := &UpgradeTask{
		ID:         uuid.New().String(),
		MerchantID: merchantID,
		Type:       "package",
		SourceType: sourceType,
		Status:     "pending",
		Progress:   0,
		Message:    "准备升级",
		StartTime:  time.Now(),
		eventChan:  make(chan UpgradeEvent, 100),
		Steps: []UpgradeStep{
			{Name: "停止 POS 服务", Status: "pending", Progress: 0},
			{Name: "复制/上传 WAR 包", Status: "pending", Progress: 0},
			{Name: "执行 update.sh", Status: "pending", Progress: 0},
			{Name: "执行配置修改", Status: "pending", Progress: 0},
			{Name: "重启 POS 服务", Status: "pending", Progress: 0},
		},
		CurrentStep: 0,
	}
	if sourceType == "local" {
		task.localUpload = make(chan string, 1)
	}

	m.mu.Lock()
	m.tasks[task.ID] = task
	m.mu.Unlock()

	return task
}

// GetTask 获取任务
func (m *UpgradeTaskManager) GetTask(taskID string) (*UpgradeTask, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	task, exists := m.tasks[taskID]
	return task, exists
}

// GetTaskSnapshot 获取任务快照
func (m *UpgradeTaskManager) GetTaskSnapshot(taskID string) (*UpgradeTaskSnapshot, bool) {
	m.mu.RLock()
	task, exists := m.tasks[taskID]
	m.mu.RUnlock()

	if !exists {
		return nil, false
	}
	return task.ToSnapshot(), true
}

// GetEventChannel 获取事件通道
func (m *UpgradeTaskManager) GetEventChannel(taskID string) (<-chan UpgradeEvent, bool) {
	m.mu.RLock()
	task, exists := m.tasks[taskID]
	m.mu.RUnlock()

	if !exists {
		return nil, false
	}
	return task.eventChan, true
}

// AttachLocalUpload binds a local browser upload to an upgrade task.
func (t *UpgradeTask) AttachLocalUpload(path string) error {
	t.mu.RLock()
	if t.SourceType != "local" || t.localUpload == nil {
		t.mu.RUnlock()
		return fmt.Errorf("task does not accept local uploads")
	}
	ch := t.localUpload
	t.mu.RUnlock()

	select {
	case ch <- path:
		return nil
	default:
		return fmt.Errorf("local upload already attached")
	}
}

// WaitForLocalUpload waits for the browser file to be attached to the task.
func (t *UpgradeTask) WaitForLocalUpload(timeout time.Duration) (string, error) {
	t.mu.RLock()
	if t.SourceType != "local" || t.localUpload == nil {
		t.mu.RUnlock()
		return "", fmt.Errorf("task does not require local upload")
	}
	ch := t.localUpload
	t.mu.RUnlock()

	select {
	case path := <-ch:
		return path, nil
	case <-time.After(timeout):
		return "", fmt.Errorf("timed out waiting for local upload")
	}
}

// RemoveTask 移除任务
func (m *UpgradeTaskManager) RemoveTask(taskID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if task, exists := m.tasks[taskID]; exists {
		close(task.eventChan)
		delete(m.tasks, taskID)
	}
}

// --- 任务操作方法 ---

// Start 开始任务
func (t *UpgradeTask) Start() {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.Status = "running"
	t.Message = "升级进行中"
	t.emitEvent("progress", t.toSnapshotLocked())
}

// UpdateStepProgress 更新步骤进度
func (t *UpgradeTask) UpdateStepProgress(stepIndex int, stepProgress int, message string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if stepIndex < 0 || stepIndex >= len(t.Steps) {
		return
	}

	t.Steps[stepIndex].Progress = stepProgress
	t.Steps[stepIndex].Status = "running"
	t.Message = message
	t.CurrentStep = stepIndex

	// 计算总进度
	t.calculateTotalProgress()

	t.emitEvent("progress", t.toSnapshotLocked())
}

// StartStep 开始步骤
func (t *UpgradeTask) StartStep(stepIndex int) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if stepIndex < 0 || stepIndex >= len(t.Steps) {
		return
	}

	// 将之前未完成的步骤标记为完成
	for i := 0; i < stepIndex; i++ {
		if t.Steps[i].Status == "pending" || t.Steps[i].Status == "running" {
			t.Steps[i].Status = "completed"
			t.Steps[i].Progress = 100
		}
	}

	t.Steps[stepIndex].Status = "running"
	t.Steps[stepIndex].Progress = 0
	t.CurrentStep = stepIndex
	t.Message = t.Steps[stepIndex].Name + "..."

	t.calculateTotalProgress()

	t.emitEvent("step", map[string]interface{}{
		"step_index": stepIndex,
		"step_name":  t.Steps[stepIndex].Name,
		"status":     "running",
		"task":       t.toSnapshotLocked(),
	})
}

// CompleteStep 完成步骤
func (t *UpgradeTask) CompleteStep(stepIndex int) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if stepIndex < 0 || stepIndex >= len(t.Steps) {
		return
	}

	t.Steps[stepIndex].Status = "completed"
	t.Steps[stepIndex].Progress = 100

	t.calculateTotalProgress()

	t.emitEvent("step", map[string]interface{}{
		"step_index": stepIndex,
		"step_name":  t.Steps[stepIndex].Name,
		"status":     "completed",
		"task":       t.toSnapshotLocked(),
	})
}

// FailStep 步骤失败
func (t *UpgradeTask) FailStep(stepIndex int, errMsg string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if stepIndex < 0 || stepIndex >= len(t.Steps) {
		return
	}

	t.Steps[stepIndex].Status = "failed"
	t.Steps[stepIndex].Message = errMsg

	t.calculateTotalProgress()

	t.emitEvent("step", map[string]interface{}{
		"step_index": stepIndex,
		"step_name":  t.Steps[stepIndex].Name,
		"status":     "failed",
		"error":      errMsg,
		"task":       t.toSnapshotLocked(),
	})
}

// Complete 完成任务
func (t *UpgradeTask) Complete() {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	t.Status = "completed"
	t.Progress = 100
	t.Message = "升级完成"
	t.EndTime = &now

	// 将所有未完成的步骤标记为完成
	for i := range t.Steps {
		if t.Steps[i].Status != "failed" {
			t.Steps[i].Status = "completed"
			t.Steps[i].Progress = 100
		}
	}

	t.emitEvent("completed", t.toSnapshotLocked())
}

// Fail 任务失败
func (t *UpgradeTask) Fail(errMsg string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := time.Now()
	t.Status = "failed"
	t.Error = errMsg
	t.Message = "升级失败: " + errMsg
	t.EndTime = &now

	t.emitEvent("error", map[string]interface{}{
		"error": errMsg,
		"task":  t.toSnapshotLocked(),
	})
}

// UpdateProgress 更新总进度
func (t *UpgradeTask) UpdateProgress(progress int, message string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	t.Progress = progress
	t.Message = message

	t.emitEvent("progress", t.toSnapshotLocked())
}

// calculateTotalProgress 计算总进度（需要在锁内调用）
func (t *UpgradeTask) calculateTotalProgress() {
	// 根据步骤进度计算总进度
	// 每个步骤占总进度的 1/len(steps)
	if len(t.Steps) == 0 {
		t.Progress = 0
		return
	}

	stepWeight := 100 / len(t.Steps)
	totalProgress := 0

	for i, step := range t.Steps {
		if step.Status == "completed" {
			totalProgress += stepWeight
		} else if step.Status == "running" {
			// 当前步骤的部分进度
			totalProgress += (stepWeight * step.Progress) / 100
		}
		// 已完成的步骤不计入后续步骤的进度
		if i < t.CurrentStep && step.Status == "completed" {
			continue
		}
	}

	t.Progress = totalProgress
	if t.Progress > 100 {
		t.Progress = 100
	}
}

// emitEvent 发送事件（需要在锁内调用）
func (t *UpgradeTask) emitEvent(eventType string, payload interface{}) {
	select {
	case t.eventChan <- UpgradeEvent{Type: eventType, Payload: payload}:
	default:
		// channel 已满，丢弃事件
	}
}

// ToJSON 转换为 JSON 字符串
func (t *UpgradeTask) ToJSON() string {
	snapshot := t.ToSnapshot()
	data, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return string(data)
}

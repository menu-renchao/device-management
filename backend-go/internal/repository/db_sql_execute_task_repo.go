package repository

import (
	"time"

	"device-management/internal/models"

	"gorm.io/gorm"
)

type DBSQLExecuteTaskRepository struct {
	db *gorm.DB
}

func NewDBSQLExecuteTaskRepository(db *gorm.DB) *DBSQLExecuteTaskRepository {
	return &DBSQLExecuteTaskRepository{db: db}
}

func (r *DBSQLExecuteTaskRepository) CreateTask(task *models.DBSQLExecuteTask) error {
	return r.db.Create(task).Error
}

func (r *DBSQLExecuteTaskRepository) CreateTaskItems(items []models.DBSQLExecuteTaskItem) error {
	if len(items) == 0 {
		return nil
	}
	return r.db.Create(&items).Error
}

func (r *DBSQLExecuteTaskRepository) FinishTask(taskID, status string, successCount, failedCount int, finishedAt time.Time, durationMS int64) error {
	return r.db.Model(&models.DBSQLExecuteTask{}).
		Where("task_id = ?", taskID).
		Updates(map[string]interface{}{
			"status":        status,
			"success_count": successCount,
			"failed_count":  failedCount,
			"finished_at":   finishedAt,
			"duration_ms":   durationMS,
		}).Error
}

func (r *DBSQLExecuteTaskRepository) GetTaskByTaskID(taskID string) (*models.DBSQLExecuteTask, error) {
	var task models.DBSQLExecuteTask
	err := r.db.Where("task_id = ?", taskID).First(&task).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *DBSQLExecuteTaskRepository) GetTaskItems(taskID string) ([]models.DBSQLExecuteTaskItem, error) {
	var items []models.DBSQLExecuteTaskItem
	err := r.db.Where("task_id = ?", taskID).Order("sql_index ASC").Find(&items).Error
	return items, err
}

func (r *DBSQLExecuteTaskRepository) ListHistory(page, pageSize int, userID uint, isAdmin bool) ([]models.DBSQLExecuteTask, int64, int64, error) {
	var tasks []models.DBSQLExecuteTask
	var total int64

	query := r.db.Model(&models.DBSQLExecuteTask{})
	if !isAdmin {
		query = query.Where("executor_user_id = ?", userID)
	}
	query.Count(&total)

	totalPages := int64(0)
	if pageSize > 0 {
		totalPages = (total + int64(pageSize) - 1) / int64(pageSize)
	}

	if page > 0 && pageSize > 0 {
		offset := (page - 1) * pageSize
		query = query.Offset(offset).Limit(pageSize)
	}

	err := query.Order("created_at DESC").Find(&tasks).Error
	return tasks, total, totalPages, err
}

package repository

import (
	"device-management/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	FeatureRequestSortHot    = "hot"
	FeatureRequestSortLatest = "latest"
)

type FeatureRequestListOptions struct {
	Status   string
	Sort     string
	Page     int
	PageSize int
}

type FeatureRequestRepository struct {
	db *gorm.DB
}

func NewFeatureRequestRepository(db *gorm.DB) *FeatureRequestRepository {
	return &FeatureRequestRepository{db: db}
}

func (r *FeatureRequestRepository) Create(request *models.FeatureRequest) error {
	return r.db.Create(request).Error
}

func (r *FeatureRequestRepository) GetByID(id uint) (*models.FeatureRequest, error) {
	var request models.FeatureRequest
	if err := r.db.First(&request, id).Error; err != nil {
		return nil, err
	}
	return &request, nil
}

func (r *FeatureRequestRepository) GetByIDs(ids []uint) ([]models.FeatureRequest, error) {
	var requests []models.FeatureRequest
	if len(ids) == 0 {
		return requests, nil
	}
	if err := r.db.Where("id IN ?", ids).Find(&requests).Error; err != nil {
		return nil, err
	}
	return requests, nil
}

func (r *FeatureRequestRepository) List(options FeatureRequestListOptions) ([]models.FeatureRequest, int64, error) {
	var requests []models.FeatureRequest
	var total int64

	query := r.db.Model(&models.FeatureRequest{})
	if options.Status != "" && options.Status != "all" {
		query = query.Where("status = ?", options.Status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	switch options.Sort {
	case "", FeatureRequestSortHot:
		query = query.Order("like_count DESC").Order("created_at DESC")
	default:
		query = query.Order("created_at DESC")
	}

	page := options.Page
	if page <= 0 {
		page = 1
	}
	pageSize := options.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&requests).Error; err != nil {
		return nil, 0, err
	}

	return requests, total, nil
}

func (r *FeatureRequestRepository) AddLike(requestID, userID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		like := &models.FeatureRequestLike{
			RequestID: requestID,
			UserID:    userID,
		}
		if err := tx.Create(like).Error; err != nil {
			return err
		}

		return tx.Model(&models.FeatureRequest{}).
			Where("id = ?", requestID).
			Update("like_count", gorm.Expr("like_count + ?", 1)).
			Error
	})
}

func (r *FeatureRequestRepository) GetLikedRequestIDs(userID uint, requestIDs []uint) (map[uint]bool, error) {
	liked := make(map[uint]bool)
	if userID == 0 || len(requestIDs) == 0 {
		return liked, nil
	}

	var likes []models.FeatureRequestLike
	if err := r.db.Where("user_id = ? AND request_id IN ?", userID, requestIDs).Find(&likes).Error; err != nil {
		return nil, err
	}

	for _, like := range likes {
		liked[like.RequestID] = true
	}

	return liked, nil
}

func (r *FeatureRequestRepository) RemoveLike(requestID, userID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Where("request_id = ? AND user_id = ?", requestID, userID).
			Delete(&models.FeatureRequestLike{})
		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected == 0 {
			return nil
		}

		return tx.Model(&models.FeatureRequest{}).
			Where("id = ?", requestID).
			UpdateColumn("like_count", clause.Expr{SQL: "CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END"}).
			Error
	})
}

func (r *FeatureRequestRepository) UpdateStatus(id uint, status string) error {
	return r.db.Model(&models.FeatureRequest{}).
		Where("id = ?", id).
		Update("status", status).
		Error
}

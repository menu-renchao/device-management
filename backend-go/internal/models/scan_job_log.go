package models

import (
	"encoding/json"
	"time"
)

type ScanJobLog struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	TriggerType      string     `gorm:"size:16;index;not null" json:"trigger_type"`
	Status           string     `gorm:"size:16;index;not null" json:"status"`
	StartedAt        time.Time  `gorm:"index;not null" json:"started_at"`
	FinishedAt       *time.Time `json:"finished_at"`
	CIDRBlocksJSON   string     `gorm:"type:text;not null;default:'[]'" json:"-"`
	Port             int        `gorm:"not null" json:"port"`
	DevicesFound     int        `gorm:"not null;default:0" json:"devices_found"`
	MerchantIDsFound int        `gorm:"not null;default:0" json:"merchant_ids_found"`
	ErrorMessage     string     `gorm:"type:text" json:"error_message"`
	TriggeredBy      string     `gorm:"size:64;not null" json:"triggered_by"`
	CreatedAt        time.Time  `json:"created_at"`
}

func (ScanJobLog) TableName() string {
	return "scan_job_logs"
}

func (l *ScanJobLog) GetCIDRBlocks() ([]string, error) {
	if l.CIDRBlocksJSON == "" {
		return []string{}, nil
	}

	var blocks []string
	if err := json.Unmarshal([]byte(l.CIDRBlocksJSON), &blocks); err != nil {
		return nil, err
	}
	return blocks, nil
}

func (l *ScanJobLog) SetCIDRBlocks(blocks []string) error {
	payload, err := json.Marshal(blocks)
	if err != nil {
		return err
	}
	l.CIDRBlocksJSON = string(payload)
	return nil
}

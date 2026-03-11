package models

import (
	"encoding/json"
	"time"
)

type AutoScanConfig struct {
	ID                     uint       `gorm:"primaryKey" json:"id"`
	Enabled                bool       `gorm:"not null;default:false" json:"enabled"`
	IntervalMinutes        int        `gorm:"not null;default:60" json:"interval_minutes"`
	CIDRBlocksJSON         string     `gorm:"type:text;not null;default:'[]'" json:"-"`
	Port                   int        `gorm:"not null;default:22080" json:"port"`
	ConnectTimeoutSeconds  int        `gorm:"not null;default:2" json:"connect_timeout_seconds"`
	RequestTimeoutSeconds  int        `gorm:"not null;default:5" json:"request_timeout_seconds"`
	MaxProbeWorkers        int        `gorm:"not null;default:200" json:"max_probe_workers"`
	MaxFetchWorkers        int        `gorm:"not null;default:100" json:"max_fetch_workers"`
	LastAutoScanStartedAt  *time.Time `json:"last_auto_scan_started_at"`
	LastAutoScanFinishedAt *time.Time `json:"last_auto_scan_finished_at"`
	UpdatedBy              *uint      `json:"updated_by"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
}

func (AutoScanConfig) TableName() string {
	return "auto_scan_configs"
}

func (c *AutoScanConfig) GetCIDRBlocks() ([]string, error) {
	if c.CIDRBlocksJSON == "" {
		return []string{}, nil
	}

	var blocks []string
	if err := json.Unmarshal([]byte(c.CIDRBlocksJSON), &blocks); err != nil {
		return nil, err
	}
	return blocks, nil
}

func (c *AutoScanConfig) SetCIDRBlocks(blocks []string) error {
	payload, err := json.Marshal(blocks)
	if err != nil {
		return err
	}
	c.CIDRBlocksJSON = string(payload)
	return nil
}

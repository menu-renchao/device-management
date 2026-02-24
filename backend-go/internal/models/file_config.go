package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

// KeyValueItem 键值对配置项
type KeyValueItem struct {
	Key       string `json:"key"`
	QAValue   string `json:"qa_value"`
	ProdValue string `json:"prod_value"`
	DevValue  string `json:"dev_value"`
}

// KeyValueList 键值对列表（用于 GORM 存储）
type KeyValueList []KeyValueItem

// Value 实现 driver.Valuer 接口
func (k KeyValueList) Value() (driver.Value, error) {
	return json.Marshal(k)
}

// Scan 实现 sql.Scanner 接口
func (k *KeyValueList) Scan(value interface{}) error {
	if value == nil {
		*k = []KeyValueItem{}
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return errors.New("type assertion to []byte or string failed")
	}

	return json.Unmarshal(bytes, k)
}

// FileConfig 文件配置模型
type FileConfig struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	Name       string         `gorm:"size:100;uniqueIndex;not null" json:"name"`
	FilePath   string         `gorm:"size:500;not null" json:"file_path"`
	KeyValues  KeyValueList   `gorm:"type:text;not null" json:"key_values"`
	Enabled    bool           `gorm:"default:true" json:"enabled"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (FileConfig) TableName() string {
	return "file_configs"
}

// GetAbsoluteRemotePath 获取远程绝对路径
func (f *FileConfig) GetAbsoluteRemotePath() string {
	return "/opt/tomcat7/webapps/" + f.FilePath
}

// GetValueByEnv 根据环境获取键值
func (k *KeyValueItem) GetValueByEnv(env string) string {
	switch env {
	case "QA":
		return k.QAValue
	case "PROD":
		return k.ProdValue
	case "DEV":
		return k.DevValue
	default:
		return k.QAValue
	}
}

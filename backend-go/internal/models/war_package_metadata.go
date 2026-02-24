package models

import "time"

// WarPackageMetadata WAR包元数据
type WarPackageMetadata struct {
	ID          int64     `json:"id" db:"id"`
	PackageName string    `json:"package_name" db:"package_name"`
	PackageType string    `json:"package_type" db:"package_type"`   // upgrade(升级包), install(安装包), war(war包)
	Version     string    `json:"version" db:"version"`
	IsRelease   bool      `json:"is_release" db:"is_release"`
	Description string    `json:"description" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// PackageType 包类型枚举
const (
	PackageTypeUpgrade = "upgrade"
	PackageTypeWar     = "war"
)

// PackageTypeLabels 包类型中文标签
var PackageTypeLabels = map[string]string{
	PackageTypeUpgrade: "安装升级包",
	PackageTypeWar:     "WAR包",
}

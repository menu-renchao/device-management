package main

import (
	"fmt"
	"log"

	"device-management/internal/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func main() {
	// 连接数据库（使用相对路径指向 backend-go 根目录的 data.db）
	dbPath := "../../data.db"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	fmt.Println("数据库路径:", dbPath)

	fmt.Println("开始清理孤儿占用记录...")
	fmt.Println()

	// 步骤 1: 查找所有占用记录
	var occupancies []models.DeviceOccupancy
	if err := db.Find(&occupancies).Error; err != nil {
		log.Fatalf("查询占用记录失败: %v", err)
	}

	fmt.Printf("找到 %d 条占用记录\n", len(occupancies))

	// 步骤 2: 查找孤儿记录（merchant_id 在 scan_results 中不存在的记录）
	// 注意：包括软删除的记录
	orphanCount := 0
	for _, occupancy := range occupancies {
		var count int64
		if err := db.Unscoped().Model(&models.ScanResult{}).
			Where("merchant_id = ?", occupancy.MerchantID).
			Count(&count).Error; err != nil {
			log.Printf("查询设备失败: merchant_id=%s, error=%v", occupancy.MerchantID, err)
			continue
		}

		if count == 0 {
			fmt.Printf("发现孤儿记录: merchant_id=%s, user_id=%d, end_time=%s\n",
				occupancy.MerchantID,
				occupancy.UserID,
				occupancy.EndTime.Format("2006-01-02 15:04:05"))

			// 删除孤儿记录
			if err := db.Delete(&occupancy).Error; err != nil {
				log.Printf("删除失败: merchant_id=%s, error=%v", occupancy.MerchantID, err)
			} else {
				orphanCount++
				fmt.Printf("  ✓ 已删除\n")
			}
		}
	}

	fmt.Println()
	fmt.Printf("清理完成！共删除 %d 条孤儿占用记录\n", orphanCount)
}

package ssh

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"

	"github.com/pkg/sftp"
)

// UploadProgress 上传进度回调
type UploadProgress func(transferred, total int64, percentage float64)

// SFTPClient SFTP 客户端
type SFTPClient struct {
	sshClient *Client
	sftp      *sftp.Client
}

// NewSFTPClient 创建 SFTP 客户端
func NewSFTPClient(sshClient *Client) (*SFTPClient, error) {
	if !sshClient.IsConnected() {
		return nil, fmt.Errorf("SSH 未连接")
	}

	sftpClient, err := sftp.NewClient(sshClient.GetClient())
	if err != nil {
		return nil, fmt.Errorf("创建 SFTP 客户端失败: %w", err)
	}

	return &SFTPClient{
		sshClient: sshClient,
		sftp:      sftpClient,
	}, nil
}

// Close 关闭 SFTP 客户端
func (c *SFTPClient) Close() error {
	if c.sftp != nil {
		return c.sftp.Close()
	}
	return nil
}

// UploadFile 上传文件（带进度回调）
func (c *SFTPClient) UploadFile(localPath, remotePath string, progress UploadProgress) error {
	// 打开本地文件
	localFile, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("打开本地文件失败: %w", err)
	}
	defer localFile.Close()

	// 获取文件大小
	fileInfo, err := localFile.Stat()
	if err != nil {
		return fmt.Errorf("获取文件信息失败: %w", err)
	}
	totalSize := fileInfo.Size()

	// 确保远程目录存在
	remoteDir := filepath.Dir(remotePath)
	if err := c.MkdirAll(remoteDir); err != nil {
		return fmt.Errorf("创建远程目录失败: %w", err)
	}

	// 创建远程文件
	remoteFile, err := c.sftp.Create(remotePath)
	if err != nil {
		return fmt.Errorf("创建远程文件失败: %w", err)
	}
	defer remoteFile.Close()

	// 使用带进度的复制
	buf := make([]byte, 32*1024) // 32KB buffer
	var transferred int64

	for {
		n, err := localFile.Read(buf)
		if n > 0 {
			written, writeErr := remoteFile.Write(buf[:n])
			if writeErr != nil {
				return fmt.Errorf("写入远程文件失败: %w", writeErr)
			}
			transferred += int64(written)

			// 回调进度
			if progress != nil {
				percentage := float64(transferred) / float64(totalSize) * 100
				progress(transferred, totalSize, percentage)
			}
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("读取本地文件失败: %w", err)
		}
	}

	return nil
}

// UploadFromReader 从 Reader 上传（带进度回调）
func (c *SFTPClient) UploadFromReader(reader io.Reader, remotePath string, totalSize int64, progress UploadProgress) error {
	// 确保远程目录存在
	remoteDir := filepath.Dir(remotePath)
	if err := c.MkdirAll(remoteDir); err != nil {
		return fmt.Errorf("创建远程目录失败: %w", err)
	}

	// 创建远程文件
	remoteFile, err := c.sftp.Create(remotePath)
	if err != nil {
		return fmt.Errorf("创建远程文件失败: %w", err)
	}
	defer remoteFile.Close()

	// 使用带进度的复制
	buf := make([]byte, 32*1024) // 32KB buffer
	var transferred int64

	for {
		n, err := reader.Read(buf)
		if n > 0 {
			written, writeErr := remoteFile.Write(buf[:n])
			if writeErr != nil {
				return fmt.Errorf("写入远程文件失败: %w", writeErr)
			}
			transferred += int64(written)

			// 回调进度
			if progress != nil {
				var percentage float64
				if totalSize > 0 {
					percentage = float64(transferred) / float64(totalSize) * 100
				}
				progress(transferred, totalSize, percentage)
			}
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("读取数据失败: %w", err)
		}
	}

	return nil
}

// DownloadFile 下载文件
func (c *SFTPClient) DownloadFile(remotePath, localPath string) error {
	// 打开远程文件
	remoteFile, err := c.sftp.Open(remotePath)
	if err != nil {
		return fmt.Errorf("打开远程文件失败: %w", err)
	}
	defer remoteFile.Close()

	// 确保本地目录存在
	localDir := filepath.Dir(localPath)
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return fmt.Errorf("创建本地目录失败: %w", err)
	}

	// 创建本地文件
	localFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("创建本地文件失败: %w", err)
	}
	defer localFile.Close()

	// 复制文件
	_, err = io.Copy(localFile, remoteFile)
	if err != nil {
		return fmt.Errorf("下载文件失败: %w", err)
	}

	return nil
}

// DownloadToReader 下载文件到 Reader
func (c *SFTPClient) DownloadToReader(remotePath string) (io.Reader, int64, error) {
	// 打开远程文件
	remoteFile, err := c.sftp.Open(remotePath)
	if err != nil {
		return nil, 0, fmt.Errorf("打开远程文件失败: %w", err)
	}

	// 获取文件大小
	fileInfo, err := remoteFile.Stat()
	if err != nil {
		remoteFile.Close()
		return nil, 0, fmt.Errorf("获取文件信息失败: %w", err)
	}

	return remoteFile, fileInfo.Size(), nil
}

// DeleteFile 删除远程文件
func (c *SFTPClient) DeleteFile(remotePath string) error {
	return c.sftp.Remove(remotePath)
}

// MkdirAll 递归创建目录
func (c *SFTPClient) MkdirAll(path string) error {
	// 标准化路径
	path = filepath.ToSlash(path)

	// 检查目录是否已存在
	_, err := c.sftp.Stat(path)
	if err == nil {
		return nil
	}

	// 递归创建
	var createDir func(string) error
	createDir = func(p string) error {
		// 检查父目录
		parent := filepath.Dir(p)
		if parent != "/" && parent != p {
			_, err := c.sftp.Stat(parent)
			if err != nil {
				if err := createDir(parent); err != nil {
					return err
				}
			}
		}

		// 创建当前目录
		return c.sftp.Mkdir(p)
	}

	return createDir(path)
}

// ListDir 列出目录内容
func (c *SFTPClient) ListDir(remotePath string) ([]os.FileInfo, error) {
	return c.sftp.ReadDir(remotePath)
}

// Stat 获取文件信息
func (c *SFTPClient) Stat(remotePath string) (os.FileInfo, error) {
	return c.sftp.Stat(remotePath)
}

// Rename 重命名文件
func (c *SFTPClient) Rename(oldPath, newPath string) error {
	return c.sftp.Rename(oldPath, newPath)
}

// CopyFile 复制远程文件
func (c *SFTPClient) CopyFile(srcPath, dstPath string) error {
	// 打开源文件
	srcFile, err := c.sftp.Open(srcPath)
	if err != nil {
		return fmt.Errorf("打开源文件失败: %w", err)
	}
	defer srcFile.Close()

	// 确保目标目录存在
	dstDir := filepath.Dir(dstPath)
	if err := c.MkdirAll(dstDir); err != nil {
		return fmt.Errorf("创建目标目录失败: %w", err)
	}

	// 创建目标文件
	dstFile, err := c.sftp.Create(dstPath)
	if err != nil {
		return fmt.Errorf("创建目标文件失败: %w", err)
	}
	defer dstFile.Close()

	// 复制内容
	_, err = io.Copy(dstFile, srcFile)
	return err
}

// UploadTask 上传任务
type UploadTask struct {
	ID          string
	LocalPath   string
	RemotePath  string
	TotalSize   int64
	Transferred int64
	Percentage  float64
	Status      string // "pending", "uploading", "completed", "failed"
	Error       error
	mu          sync.RWMutex
}

// UpdateProgress 更新进度
func (t *UploadTask) UpdateProgress(transferred int64, percentage float64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Transferred = transferred
	t.Percentage = percentage
	t.Status = "uploading"
}

// SetCompleted 设置完成
func (t *UploadTask) SetCompleted() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Transferred = t.TotalSize
	t.Percentage = 100
	t.Status = "completed"
}

// SetFailed 设置失败
func (t *UploadTask) SetFailed(err error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Status = "failed"
	t.Error = err
}

// GetStatus 获取状态
func (t *UploadTask) GetStatus() (int64, int64, float64, string, error) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.Transferred, t.TotalSize, t.Percentage, t.Status, t.Error
}

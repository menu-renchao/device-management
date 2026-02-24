package ssh

import (
	"fmt"
	"sync"
	"time"
)

// SessionInfo 会话信息
type SessionInfo struct {
	Client     *Client
	SFTPClient *SFTPClient
	Config     *Config
	Password   string // 保存密码用于 sudo 命令
	Connected  bool
	ConnectAt  time.Time
	LastActive time.Time
}

// SessionPool 会话池
type SessionPool struct {
	sessions map[string]*SessionInfo
	mu       sync.RWMutex
}

// globalPool 全局会话池
var globalPool = &SessionPool{
	sessions: make(map[string]*SessionInfo),
}

// GetSessionPool 获取全局会话池
func GetSessionPool() *SessionPool {
	return globalPool
}

// Connect 建立连接并存储到池中
func (p *SessionPool) Connect(merchantID string, config *Config) (*SessionInfo, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// 检查是否已存在连接
	if info, exists := p.sessions[merchantID]; exists {
		if info.Client.IsConnected() {
			info.LastActive = time.Now()
			return info, nil
		}
		// 连接已断开，清理旧连接
		delete(p.sessions, merchantID)
	}

	// 创建新连接
	client := NewClient(config)
	if err := client.Connect(); err != nil {
		return nil, err
	}

	// 创建 SFTP 客户端
	sftpClient, err := NewSFTPClient(client)
	if err != nil {
		client.Disconnect()
		return nil, fmt.Errorf("创建 SFTP 客户端失败: %w", err)
	}

	info := &SessionInfo{
		Client:     client,
		SFTPClient: sftpClient,
		Config:     config,
		Password:   config.Password,
		Connected:  true,
		ConnectAt:  time.Now(),
		LastActive: time.Now(),
	}

	p.sessions[merchantID] = info
	return info, nil
}

// Disconnect 断开指定连接
func (p *SessionPool) Disconnect(merchantID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	info, exists := p.sessions[merchantID]
	if !exists {
		return nil
	}

	var err error
	if info.SFTPClient != nil {
		if closeErr := info.SFTPClient.Close(); closeErr != nil {
			err = closeErr
		}
	}
	if info.Client != nil {
		if disconnectErr := info.Client.Disconnect(); disconnectErr != nil {
			if err == nil {
				err = disconnectErr
			}
		}
	}

	delete(p.sessions, merchantID)
	return err
}

// Get 获取会话
func (p *SessionPool) Get(merchantID string) (*SessionInfo, bool) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	info, exists := p.sessions[merchantID]
	if !exists {
		return nil, false
	}

	if !info.Client.IsConnected() {
		return nil, false
	}

	info.LastActive = time.Now()
	return info, true
}

// IsConnected 检查是否已连接
func (p *SessionPool) IsConnected(merchantID string) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()

	info, exists := p.sessions[merchantID]
	if !exists {
		return false
	}

	return info.Client.IsConnected()
}

// GetAll 获取所有会话
func (p *SessionPool) GetAll() map[string]*SessionInfo {
	p.mu.RLock()
	defer p.mu.RUnlock()

	result := make(map[string]*SessionInfo)
	for k, v := range p.sessions {
		result[k] = v
	}
	return result
}

// DisconnectAll 断开所有连接
func (p *SessionPool) DisconnectAll() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for merchantID, info := range p.sessions {
		if info.SFTPClient != nil {
			info.SFTPClient.Close()
		}
		if info.Client != nil {
			info.Client.Disconnect()
		}
		delete(p.sessions, merchantID)
	}
}

// CleanupInactive 清理不活跃的连接
func (p *SessionPool) CleanupInactive(timeout time.Duration) int {
	p.mu.Lock()
	defer p.mu.Unlock()

	count := 0
	now := time.Now()

	for merchantID, info := range p.sessions {
		if now.Sub(info.LastActive) > timeout {
			if info.SFTPClient != nil {
				info.SFTPClient.Close()
			}
			if info.Client != nil {
				info.Client.Disconnect()
			}
			delete(p.sessions, merchantID)
			count++
		}
	}

	return count
}

// Reconnect 重新连接
func (p *SessionPool) Reconnect(merchantID string) (*SessionInfo, error) {
	p.mu.RLock()
	info, exists := p.sessions[merchantID]
	p.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("会话不存在: %s", merchantID)
	}

	// 先断开
	p.Disconnect(merchantID)

	// 重新连接
	return p.Connect(merchantID, info.Config)
}

// GetSessionCount 获取会话数量
func (p *SessionPool) GetSessionCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.sessions)
}

// StartCleanupRoutine 启动定期清理协程
func (p *SessionPool) StartCleanupRoutine(interval, timeout time.Duration) chan struct{} {
	stop := make(chan struct{})

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				p.CleanupInactive(timeout)
			case <-stop:
				return
			}
		}
	}()

	return stop
}

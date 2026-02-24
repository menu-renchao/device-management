package ssh

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"time"

	"golang.org/x/crypto/ssh"
)

// Config SSH 连接配置
type Config struct {
	Host     string
	Port     int
	User     string
	Password string
	Timeout  time.Duration
}

// Client SSH 客户端
type Client struct {
	config     *Config
	client     *ssh.Client
	connected  bool
	lastError  error
	connectAt  time.Time
}

// NewClient 创建新的 SSH 客户端
func NewClient(config *Config) *Client {
	if config.Port == 0 {
		config.Port = 22
	}
	if config.Timeout == 0 {
		config.Timeout = 10 * time.Second
	}
	return &Client{
		config: config,
	}
}

// Connect 建立 SSH 连接
func (c *Client) Connect() error {
	if c.connected {
		return nil
	}

	sshConfig := &ssh.ClientConfig{
		User: c.config.User,
		Auth: []ssh.AuthMethod{
			ssh.Password(c.config.Password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         c.config.Timeout,
	}

	addr := fmt.Sprintf("%s:%d", c.config.Host, c.config.Port)
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		c.lastError = err
		return fmt.Errorf("SSH 连接失败: %w", err)
	}

	c.client = client
	c.connected = true
	c.connectAt = time.Now()
	c.lastError = nil

	return nil
}

// Disconnect 断开 SSH 连接
func (c *Client) Disconnect() error {
	if !c.connected || c.client == nil {
		return nil
	}

	err := c.client.Close()
	c.client = nil
	c.connected = false

	return err
}

// IsConnected 检查连接状态
func (c *Client) IsConnected() bool {
	return c.connected && c.client != nil
}

// ExecuteCommand 执行远程命令
func (c *Client) ExecuteCommand(cmd string) (string, error) {
	if !c.IsConnected() {
		return "", fmt.Errorf("SSH 未连接")
	}

	session, err := c.client.NewSession()
	if err != nil {
		return "", fmt.Errorf("创建会话失败: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	err = session.Run(cmd)
	if err != nil {
		return stderr.String(), fmt.Errorf("命令执行失败: %w, stderr: %s", err, stderr.String())
	}

	return stdout.String(), nil
}

// ExecuteCommandWithTimeout 执行远程命令（带超时）
func (c *Client) ExecuteCommandWithTimeout(cmd string, timeout time.Duration) (string, error) {
	if !c.IsConnected() {
		return "", fmt.Errorf("SSH 未连接")
	}

	session, err := c.client.NewSession()
	if err != nil {
		return "", fmt.Errorf("创建会话失败: %w", err)
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	// 设置命令超时
	done := make(chan error, 1)
	go func() {
		done <- session.Run(cmd)
	}()

	select {
	case err := <-done:
		if err != nil {
			return stderr.String(), fmt.Errorf("命令执行失败: %w", err)
		}
		return stdout.String(), nil
	case <-time.After(timeout):
		return "", fmt.Errorf("命令执行超时")
	}
}

// NewSession 创建新会话
func (c *Client) NewSession() (*ssh.Session, error) {
	if !c.IsConnected() {
		return nil, fmt.Errorf("SSH 未连接")
	}
	return c.client.NewSession()
}

// GetClient 获取底层 ssh.Client
func (c *Client) GetClient() *ssh.Client {
	return c.client
}

// GetLastError 获取最后的错误
func (c *Client) GetLastError() error {
	return c.lastError
}

// GetConnectTime 获取连接时间
func (c *Client) GetConnectTime() time.Time {
	return c.connectAt
}

// GetHost 获取主机地址
func (c *Client) GetHost() string {
	return c.config.Host
}

// TestConnection 测试连接
func (c *Client) TestConnection() error {
	if err := c.Connect(); err != nil {
		return err
	}

	// 执行简单命令测试
	_, err := c.ExecuteCommand("echo test")
	if err != nil {
		c.Disconnect()
		return fmt.Errorf("连接测试失败: %w", err)
	}

	return nil
}

// StartCommand 启动命令并返回会话（用于实时输出）
func (c *Client) StartCommand(cmd string) (*CommandSession, error) {
	if !c.IsConnected() {
		return nil, fmt.Errorf("SSH 未连接")
	}

	session, err := c.client.NewSession()
	if err != nil {
		return nil, fmt.Errorf("创建会话失败: %w", err)
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		return nil, fmt.Errorf("创建 stdout pipe 失败: %w", err)
	}

	stderr, err := session.StderrPipe()
	if err != nil {
		session.Close()
		return nil, fmt.Errorf("创建 stderr pipe 失败: %w", err)
	}

	if err := session.Start(cmd); err != nil {
		session.Close()
		return nil, fmt.Errorf("启动命令失败: %w", err)
	}

	return &CommandSession{
		Session: session,
		Stdout:  stdout,
		Stderr:  stderr,
	}, nil
}

// CommandSession 命令会话
type CommandSession struct {
	Session *ssh.Session
	Stdout  io.Reader
	Stderr  io.Reader
}

// Wait 等待命令完成
func (cs *CommandSession) Wait() error {
	return cs.Session.Wait()
}

// Close 关闭会话
func (cs *CommandSession) Close() error {
	return cs.Session.Close()
}

// CheckPortReachable 检查端口是否可达
func CheckPortReachable(host string, port int, timeout time.Duration) bool {
	if timeout == 0 {
		timeout = 5 * time.Second
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

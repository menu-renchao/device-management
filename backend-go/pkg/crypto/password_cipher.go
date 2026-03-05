package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
)

// EncryptPassword 使用 AES-GCM 加密密码，返回 base64(nonce+ciphertext)
func EncryptPassword(plainText, secret string) (string, error) {
	if plainText == "" {
		return "", fmt.Errorf("plain text cannot be empty")
	}
	aead, err := newAEAD(secret)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce failed: %w", err)
	}

	cipherText := aead.Seal(nil, nonce, []byte(plainText), nil)
	payload := append(nonce, cipherText...)
	return base64.StdEncoding.EncodeToString(payload), nil
}

// DecryptPassword 解密 EncryptPassword 生成的密文
func DecryptPassword(encodedText, secret string) (string, error) {
	if encodedText == "" {
		return "", fmt.Errorf("encrypted text cannot be empty")
	}
	aead, err := newAEAD(secret)
	if err != nil {
		return "", err
	}

	payload, err := base64.StdEncoding.DecodeString(encodedText)
	if err != nil {
		return "", fmt.Errorf("decode encrypted text failed: %w", err)
	}
	if len(payload) <= aead.NonceSize() {
		return "", fmt.Errorf("invalid encrypted payload")
	}

	nonce := payload[:aead.NonceSize()]
	cipherText := payload[aead.NonceSize():]
	plain, err := aead.Open(nil, nonce, cipherText, nil)
	if err != nil {
		return "", fmt.Errorf("decrypt password failed: %w", err)
	}
	return string(plain), nil
}

func newAEAD(secret string) (cipher.AEAD, error) {
	if secret == "" {
		return nil, fmt.Errorf("secret cannot be empty")
	}
	key := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, fmt.Errorf("create cipher failed: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm failed: %w", err)
	}
	return aead, nil
}

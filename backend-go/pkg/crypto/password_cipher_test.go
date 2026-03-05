package crypto

import "testing"

func TestEncryptDecryptPassword(t *testing.T) {
	secret := "dev-secret-key"
	plain := "P@ssw0rd!"

	encrypted, err := EncryptPassword(plain, secret)
	if err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}
	if encrypted == plain {
		t.Fatalf("encrypted text should not equal plain text")
	}

	decrypted, err := DecryptPassword(encrypted, secret)
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	if decrypted != plain {
		t.Fatalf("want %s got %s", plain, decrypted)
	}
}

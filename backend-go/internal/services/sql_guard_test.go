package services

import "testing"

func TestSplitSQLStatements(t *testing.T) {
	raw := `
		-- 这是注释
		UPDATE test_table SET name = 'x';
		;
		DELETE FROM test_table WHERE id = 1;
	`

	statements := SplitSQLStatements(raw)
	if len(statements) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(statements))
	}
}

func TestDetectSQLRisk(t *testing.T) {
	risk := DetectSQLRisk("DELETE FROM users")
	if !risk.Blocked {
		t.Fatalf("expected blocked risk")
	}
	if risk.Type != "delete_without_where" {
		t.Fatalf("unexpected risk type: %s", risk.Type)
	}
}

func TestFindBlockedRisks(t *testing.T) {
	input := []string{
		"UPDATE users SET name = 'ok' WHERE id = 1",
		"TRUNCATE TABLE users",
	}
	risks := FindBlockedRisks(input)
	if len(risks) != 1 {
		t.Fatalf("expected 1 risk, got %d", len(risks))
	}
	if risks[0].Index != 2 {
		t.Fatalf("expected index 2, got %d", risks[0].Index)
	}
}

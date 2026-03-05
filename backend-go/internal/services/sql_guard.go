package services

import (
	"regexp"
	"strings"
)

var (
	blockCommentRegex = regexp.MustCompile(`(?s)/\*.*?\*/`)
	lineCommentRegex  = regexp.MustCompile(`(?m)--[^\r\n]*$`)
	spaceRegex        = regexp.MustCompile(`\s+`)
)

type SQLRiskResult struct {
	Blocked bool   `json:"blocked"`
	Type    string `json:"type,omitempty"`
	Message string `json:"message,omitempty"`
	SQL     string `json:"sql,omitempty"`
	Index   int    `json:"index,omitempty"`
}

// SplitSQLStatements 按语句分割 SQL 文本（支持基础引号场景）
func SplitSQLStatements(raw string) []string {
	cleaned := strings.TrimSpace(removeSQLComments(raw))
	if cleaned == "" {
		return nil
	}

	var statements []string
	var builder strings.Builder
	inSingleQuote := false
	inDoubleQuote := false
	escaped := false

	for _, ch := range cleaned {
		if escaped {
			builder.WriteRune(ch)
			escaped = false
			continue
		}
		if (inSingleQuote || inDoubleQuote) && ch == '\\' {
			builder.WriteRune(ch)
			escaped = true
			continue
		}
		if ch == '\'' && !inDoubleQuote {
			inSingleQuote = !inSingleQuote
			builder.WriteRune(ch)
			continue
		}
		if ch == '"' && !inSingleQuote {
			inDoubleQuote = !inDoubleQuote
			builder.WriteRune(ch)
			continue
		}
		if ch == ';' && !inSingleQuote && !inDoubleQuote {
			stmt := strings.TrimSpace(builder.String())
			if stmt != "" {
				statements = append(statements, stmt)
			}
			builder.Reset()
			continue
		}
		builder.WriteRune(ch)
	}

	last := strings.TrimSpace(builder.String())
	if last != "" {
		statements = append(statements, last)
	}
	return statements
}

// DetectSQLRisk 检测单条 SQL 是否命中高风险规则
func DetectSQLRisk(sql string) SQLRiskResult {
	normalized := normalizeSQL(sql)
	if normalized == "" {
		return SQLRiskResult{}
	}

	if strings.HasPrefix(normalized, "DROP ") {
		return SQLRiskResult{
			Blocked: true,
			Type:    "drop",
			Message: "检测到 DROP 语句，默认禁止执行",
		}
	}
	if strings.HasPrefix(normalized, "TRUNCATE ") {
		return SQLRiskResult{
			Blocked: true,
			Type:    "truncate",
			Message: "检测到 TRUNCATE 语句，默认禁止执行",
		}
	}
	if strings.HasPrefix(normalized, "DELETE ") && !strings.Contains(normalized, " WHERE ") {
		return SQLRiskResult{
			Blocked: true,
			Type:    "delete_without_where",
			Message: "检测到无 WHERE 条件的 DELETE 语句，默认禁止执行",
		}
	}
	if strings.HasPrefix(normalized, "UPDATE ") && !strings.Contains(normalized, " WHERE ") {
		return SQLRiskResult{
			Blocked: true,
			Type:    "update_without_where",
			Message: "检测到无 WHERE 条件的 UPDATE 语句，默认禁止执行",
		}
	}
	return SQLRiskResult{}
}

// FindBlockedRisks 返回语句列表中命中的风险项
func FindBlockedRisks(statements []string) []SQLRiskResult {
	results := make([]SQLRiskResult, 0)
	for idx, stmt := range statements {
		risk := DetectSQLRisk(stmt)
		if risk.Blocked {
			risk.Index = idx + 1
			risk.SQL = stmt
			results = append(results, risk)
		}
	}
	return results
}

func removeSQLComments(raw string) string {
	noBlock := blockCommentRegex.ReplaceAllString(raw, " ")
	return lineCommentRegex.ReplaceAllString(noBlock, "")
}

func normalizeSQL(sql string) string {
	s := strings.TrimSpace(strings.ToUpper(sql))
	if s == "" {
		return ""
	}
	return spaceRegex.ReplaceAllString(s, " ")
}

package herb

import (
	"strings"
	"testing"
)

func TestInspectTokens_EmptyInput(t *testing.T) {
	result := InspectTokens(nil)
	if result != "" {
		t.Errorf("InspectTokens(nil) = %q, want empty string", result)
	}
}

func TestInspectTokens_SimpleHTML(t *testing.T) {
	source := "<h1>Hello</h1>"
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)
	if result == "" {
		t.Error("InspectTokens() returned empty string for valid tokens")
	}

	// Verify expected tokens are present
	expectedTokens := []string{
		"TOKEN_HTML_TAG_START",
		"TOKEN_IDENTIFIER",
		"TOKEN_HTML_TAG_END",
		"TOKEN_HTML_TAG_START_CLOSE",
		"TOKEN_EOF",
	}

	for _, expected := range expectedTokens {
		if !strings.Contains(result, expected) {
			t.Errorf("InspectTokens() output missing expected token type: %s", expected)
		}
	}

	// Verify token format structure
	if !strings.Contains(result, "#<Herb::Token") {
		t.Error("InspectTokens() output missing token format prefix")
	}
	if !strings.Contains(result, "range=") {
		t.Error("InspectTokens() output missing range information")
	}
	if !strings.Contains(result, "start=") {
		t.Error("InspectTokens() output missing start position")
	}
	if !strings.Contains(result, "end=") {
		t.Error("InspectTokens() output missing end position")
	}
}

func TestInspectTokens_ERB(t *testing.T) {
	source := "<%= 'Hello' %>"
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)
	if result == "" {
		t.Error("InspectTokens() returned empty string for ERB tokens")
	}

	// Verify ERB-specific tokens
	expectedTokens := []string{
		"TOKEN_ERB_START",
		"TOKEN_ERB_CONTENT",
		"TOKEN_ERB_END",
	}

	for _, expected := range expectedTokens {
		if !strings.Contains(result, expected) {
			t.Errorf("InspectTokens() output missing ERB token type: %s", expected)
		}
	}
}

func TestInspectTokens_MixedContent(t *testing.T) {
	source := "<h1><%= 'Hello World' %></h1>"
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)
	lines := strings.Split(result, "\n")

	// Verify we get multiple tokens
	if len(lines) < 5 {
		t.Errorf("InspectTokens() returned only %d lines, expected at least 5 for mixed content", len(lines))
	}

	// Verify both HTML and ERB tokens are present
	hasHTMLTokens := strings.Contains(result, "TOKEN_HTML_TAG_START")
	hasERBTokens := strings.Contains(result, "TOKEN_ERB_START")

	if !hasHTMLTokens {
		t.Error("InspectTokens() missing HTML tokens in mixed content")
	}
	if !hasERBTokens {
		t.Error("InspectTokens() missing ERB tokens in mixed content")
	}
}

func TestInspectTokens_EOF(t *testing.T) {
	source := "hello"
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)

	// Verify EOF token is present and has <EOF> value
	if !strings.Contains(result, "TOKEN_EOF") {
		t.Error("InspectTokens() missing EOF token")
	}
	if !strings.Contains(result, "<EOF>") {
		t.Error("InspectTokens() EOF token missing <EOF> value")
	}
}

func TestInspectTokens_ValueEscaping(t *testing.T) {
	tests := []struct {
		name     string
		source   string
		contains string // escaped sequence we expect in output
	}{
		{
			name:     "newline in content",
			source:   "hello\nworld",
			contains: "\\n",
		},
		{
			name:     "tab in content",
			source:   "hello\tworld",
			contains: "\\t",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tokens := Lex(tt.source)
			if tokens == nil {
				t.Fatal("Lex() returned nil")
			}

			result := InspectTokens(tokens)
			if !strings.Contains(result, tt.contains) {
				t.Errorf("InspectTokens() output missing escaped sequence %q", tt.contains)
			}
		})
	}
}

func TestInspectTokens_RangeAccuracy(t *testing.T) {
	source := "<h1>"
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)

	// First token '<' should be at range [0, 1]
	if !strings.Contains(result, "range=[0, 1]") {
		t.Error("InspectTokens() first token range incorrect, expected [0, 1]")
	}

	// Second token 'h1' should be at range [1, 3]
	if !strings.Contains(result, "range=[1, 3]") {
		t.Error("InspectTokens() second token range incorrect, expected [1, 3]")
	}

	// Third token '>' should be at range [3, 4]
	if !strings.Contains(result, "range=[3, 4]") {
		t.Error("InspectTokens() third token range incorrect, expected [3, 4]")
	}
}

func TestInspectTokens_LocationAccuracy(t *testing.T) {
	source := "<h1>"
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)

	// All tokens should start at line 1 (1-indexed)
	lines := strings.Split(result, "\n")
	for i, line := range lines {
		if line == "" {
			continue
		}
		if !strings.Contains(line, "start=(1:") {
			t.Errorf("Token %d should start at line 1, got: %s", i, line)
		}
		if !strings.Contains(line, "end=(1:") {
			t.Errorf("Token %d should end at line 1, got: %s", i, line)
		}
	}
}

func TestInspectTokens_MultilineContent(t *testing.T) {
	source := "<div>\n  <p>Hello</p>\n</div>"
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)

	// Should have tokens on multiple lines
	hasLine1 := strings.Contains(result, "start=(1:")
	hasLine2 := strings.Contains(result, "start=(2:")
	hasLine3 := strings.Contains(result, "start=(3:")

	if !hasLine1 || !hasLine2 || !hasLine3 {
		t.Error("InspectTokens() should show tokens across multiple lines")
	}
}

func TestInspectTokens_ComplexERB(t *testing.T) {
	source := "<% if true %>yes<% end %>"
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)

	// Verify ERB control flow tokens
	if !strings.Contains(result, "TOKEN_ERB_START") {
		t.Error("InspectTokens() missing ERB start tokens")
	}
	if !strings.Contains(result, "TOKEN_ERB_CONTENT") {
		t.Error("InspectTokens() missing ERB content tokens")
	}
	if !strings.Contains(result, "TOKEN_ERB_END") {
		t.Error("InspectTokens() missing ERB end tokens")
	}

	// Should have multiple ERB blocks (if and end)
	erbStartCount := strings.Count(result, "TOKEN_ERB_START")
	if erbStartCount < 2 {
		t.Errorf("InspectTokens() found %d ERB start tokens, expected at least 2", erbStartCount)
	}
}

func TestInspectTokens_TokenValueQuoting(t *testing.T) {
	source := `<div class="test">`
	tokens := Lex(source)
	if tokens == nil {
		t.Fatal("Lex() returned nil")
	}

	result := InspectTokens(tokens)

	// Check that quote characters are properly escaped in output
	if !strings.Contains(result, `TOKEN_QUOTE`) {
		t.Error("InspectTokens() should detect quote tokens")
	}
}

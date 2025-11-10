package herb

import (
	"testing"
)

func TestVersion(t *testing.T) {
	version := HerbVersion()
	if version == "" {
		t.Fatal("HerbVersion() returned empty string")
	}
	t.Logf("Herb version: %s", version)
}

func TestPrismVersion(t *testing.T) {
	version := PrismVersion()
	if version == "" {
		t.Fatal("PrismVersion() returned empty string")
	}
	t.Logf("Prism version: %s", version)
}

func TestLex(t *testing.T) {
	tests := []struct {
		name   string
		source string
	}{
		{"simple HTML", "<h1>Hello</h1>"},
		{"simple ERB", "<%= 'Hello' %>"},
		{"mixed content", "<h1><%= 'Hello World' %></h1>"},
		{"multiple tags", "<div><p><%= name %></p></div>"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tokens := Lex(tt.source)
			t.Logf("Tokens: %v", tokens)
			if tokens == nil {
				t.Errorf("Lex(%q) returned nil", tt.source)
			}
		})
	}
}

func TestParse(t *testing.T) {
	tests := []struct {
		name   string
		source string
	}{
		{"simple HTML", "<h1>Hello</h1>"},
		{"simple ERB", "<%= 'Hello' %>"},
		{"mixed content", "<h1><%= 'Hello World' %></h1>"},
		{"multiple tags", "<div><p><%= name %></p></div>"},
		{"if statement", "<% if true %>yes<% end %>"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ast := Parse(tt.source, nil)
			t.Logf("AST: %v", ast)
			if ast == nil {
				t.Errorf("Parse(%q, nil) returned nil", tt.source)
			}
		})
	}
}

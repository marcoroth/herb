package herb

/*
#include "herb_go.h"
#include <stdlib.h>
*/
import "C"

import (
	"fmt"
	"strings"
)

// TokenInfo represents a single token with all its information
type TokenInfo struct {
	Type     string
	Value    string
	Range    [2]uint
	StartPos [2]uint // [line, column]
	EndPos   [2]uint // [line, column]
}

// InspectTokens returns a formatted string representation of all tokens
// similar to Rust's inspect() method
func InspectTokens(tokens *hbarray) string {
	if tokens == nil {
		return ""
	}

	// Call C functions directly
	cArray := (*C.hb_array_T)(tokens)
	size := uint64(C.hb_array_size(cArray))

	if size == 0 {
		return ""
	}

	var result strings.Builder
	for i := range size {
		tokenPtr := C.hb_array_get(cArray, C.ulong(i))
		if tokenPtr == nil {
			continue
		}

		token := (*C.token_T)(tokenPtr)
		tokenInfo := extractTokenInfo(token)
		result.WriteString(formatToken(tokenInfo))
		if i < size-1 {
			result.WriteString("\n")
		}
	}

	return result.String()
}

// extractTokenInfo extracts token information from C token_T pointer
func extractTokenInfo(token *C.token_T) TokenInfo {
	typeStr := C.GoString(C.token_type_to_string(token._type))

	var value string
	if token.value == nil {
		value = ""
	} else {
		value = C.GoString(token.value)
	}

	// Handle EOF special case
	if typeStr == "TOKEN_EOF" && value == "" {
		value = "<EOF>"
	}

	return TokenInfo{
		Type:     typeStr,
		Value:    escapeValue(value),
		Range:    [2]uint{uint(token._range.from), uint(token._range.to)},
		StartPos: [2]uint{uint(token.location.start.line), uint(token.location.start.column)},
		EndPos:   [2]uint{uint(token.location.end.line), uint(token.location.end.column)},
	}
}

// escapeValue escapes special characters in token value
func escapeValue(value string) string {
	value = strings.ReplaceAll(value, "\\", "\\\\")
	value = strings.ReplaceAll(value, "\n", "\\n")
	value = strings.ReplaceAll(value, "\r", "\\r")
	value = strings.ReplaceAll(value, "\t", "\\t")
	value = strings.ReplaceAll(value, "\"", "\\\"")
	return value
}

// formatToken formats a single token similar to Rust's inspect()
func formatToken(t TokenInfo) string {
	return fmt.Sprintf(
		`#<Herb::Token type="%s" value="%s" range=[%d, %d] start=(%d:%d) end=(%d:%d)>`,
		t.Type,
		t.Value,
		t.Range[0], t.Range[1],
		t.StartPos[0], t.StartPos[1],
		t.EndPos[0], t.EndPos[1],
	)
}

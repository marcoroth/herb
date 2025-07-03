package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type AnalysisResult struct {
	Messages []LintMessage `json:"messages"`
	Errors   int           `json:"errors"`
	Warnings int           `json:"warnings"`
	Success  bool          `json:"success"`
	Output   string        `json:"output"`
}

type LintMessage struct {
	Rule     string   `json:"rule"`
	Message  string   `json:"message"`
	Location Location `json:"location"`
	Severity string   `json:"severity"`
}

type Location struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

type Position struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

func analyzeERB(content string) (*AnalysisResult, error) {
	if strings.TrimSpace(content) == "" {
		return &AnalysisResult{
			Success: true,
			Output:  "Enter ERB code to see analysis...",
		}, nil
	}

	// Create temporary file
	tmpFile, err := ioutil.TempFile("", "erb-*.html.erb")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %v", err)
	}
	defer os.Remove(tmpFile.Name())

	// Write content to temp file
	if _, err := tmpFile.Write([]byte(content)); err != nil {
		return nil, fmt.Errorf("failed to write temp file: %v", err)
	}
	tmpFile.Close()

	// Find herb-lint executable
	herbLintPath := findHerbLintPath()
	if herbLintPath == "" {
		return &AnalysisResult{
			Success: false,
			Output:  "❌ herb-lint not found. Make sure to run 'npm install' in the project root.",
		}, nil
	}

	// Execute herb-lint with stderr suppressed
	cmd := exec.Command("node", herbLintPath, "--format", "simple", "--no-color", tmpFile.Name())
	output, err := cmd.Output() // Only capture stdout, ignore stderr

	result := &AnalysisResult{
		Success: err == nil,
		Output:  parseHerbLintOutput(string(output), err),
	}

	return result, nil
}

func findHerbLintPath() string {
	// Try relative paths from playground-cli directory
	candidates := []string{
		"../javascript/packages/linter/bin/herb-lint",
		"../javascript/packages/linter/dist/herb-lint.js",
		"../../javascript/packages/linter/bin/herb-lint",
		"../../javascript/packages/linter/dist/herb-lint.js",
	}

	for _, candidate := range candidates {
		if absPath, err := filepath.Abs(candidate); err == nil {
			if _, err := os.Stat(absPath); err == nil {
				return absPath
			}
		}
	}

	return ""
}

func parseHerbLintOutput(output string, err error) string {
	lines := strings.Split(strings.TrimSpace(output), "\n")

	if err != nil {
		// Parse error output
		result := []string{
			"🔍 Herb Linter Analysis",
			"=======================",
			"",
		}

		if strings.Contains(output, "error") || strings.Contains(output, "Error") {
			result = append(result, "❌ Linting Issues Found:")
			result = append(result, "")
			for _, line := range lines {
				if strings.TrimSpace(line) != "" {
					result = append(result, "  • "+strings.TrimSpace(line))
				}
			}
		} else {
			result = append(result, "❌ Analysis failed:")
			result = append(result, "  "+output)
		}

		return strings.Join(result, "\n")
	}

	// Successful analysis
	result := []string{
		"🔍 Herb Linter Analysis",
		"=======================",
		"",
		"✅ Parse successful",
		"",
	}

	if len(lines) > 0 && strings.TrimSpace(lines[0]) != "" {
		// Has output - likely warnings or suggestions
		result = append(result, "⚠️  Issues found:")
		result = append(result, "")
		for _, line := range lines {
			if strings.TrimSpace(line) != "" {
				result = append(result, "  • "+strings.TrimSpace(line))
			}
		}
	} else {
		// No issues
		result = append(result, "🎉 No linting issues found!")
		result = append(result, "")
		result = append(result, "Your ERB code follows all")
		result = append(result, "linting rules and best practices.")
	}

	result = append(result, "")
	result = append(result, "⏱️  Real-time analysis via herb-lint")

	return strings.Join(result, "\n")
}
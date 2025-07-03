package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func analyzeHerbViewsWithLinter(content string) (parse, lex, ruby, html, linter string) {
	if strings.TrimSpace(content) == "" {
		return "Enter ERB code to see parse result...",
			"Enter ERB code to see lex result...",
			"Enter ERB code to see extracted Ruby...",
			"Enter ERB code to see extracted HTML...",
			"Enter ERB code to see linter results..."
	}

	// Create temporary file
	tmpFile, err := ioutil.TempFile("", "erb-*.html.erb")
	if err != nil {
		errMsg := fmt.Sprintf("Failed to create temp file: %v", err)
		return errMsg, errMsg, errMsg, errMsg, errMsg
	}
	defer os.Remove(tmpFile.Name())

	// Write content to temp file
	if _, err := tmpFile.Write([]byte(content)); err != nil {
		errMsg := fmt.Sprintf("Failed to write temp file: %v", err)
		return errMsg, errMsg, errMsg, errMsg, errMsg
	}
	tmpFile.Close()

	// Find the herb-analyzer.js script
	scriptPath := findHerbAnalyzerScript()
	if scriptPath == "" {
		errMsg := "herb-analyzer.js not found"
		return errMsg, errMsg, errMsg, errMsg, errMsg
	}

	// Execute the analysis script with stderr suppressed
	cmd := exec.Command("node", scriptPath, tmpFile.Name())
	output, err := cmd.Output() // Only capture stdout, ignore stderr

	if err != nil {
		errMsg := fmt.Sprintf("Analysis failed: %v", err)
		return errMsg, errMsg, errMsg, errMsg, errMsg
	}

	// Parse JSON output
	var result HerbAnalysisResult
	if err := json.Unmarshal(output, &result); err != nil {
		// Debug: show first 100 chars of output
		preview := string(output)
		if len(preview) > 100 {
			preview = preview[:100] + "..."
		}
		errMsg := fmt.Sprintf("Failed to parse analysis result: %v\nFirst 100 chars: %s", err, preview)
		return errMsg, errMsg, errMsg, errMsg, errMsg
	}

	return formatParseResult(result.Parse),
		formatLexResult(result.Lex),
		formatRubyResult(result.Ruby),
		formatHTMLResult(result.HTML),
		result.Linter
}

func analyzeHerbViews(content string) (parse, lex, ruby, html string) {
	if strings.TrimSpace(content) == "" {
		return "Enter ERB code to see parse result...",
			"Enter ERB code to see lex result...",
			"Enter ERB code to see extracted Ruby...",
			"Enter ERB code to see extracted HTML..."
	}

	// Create temporary file
	tmpFile, err := ioutil.TempFile("", "erb-*.html.erb")
	if err != nil {
		errMsg := fmt.Sprintf("Failed to create temp file: %v", err)
		return errMsg, errMsg, errMsg, errMsg
	}
	defer os.Remove(tmpFile.Name())

	// Write content to temp file
	if _, err := tmpFile.Write([]byte(content)); err != nil {
		errMsg := fmt.Sprintf("Failed to write temp file: %v", err)
		return errMsg, errMsg, errMsg, errMsg
	}
	tmpFile.Close()

	// Find the herb-analyzer.js script
	scriptPath := findHerbAnalyzerScript()
	if scriptPath == "" {
		errMsg := "herb-analyzer.js not found"
		return errMsg, errMsg, errMsg, errMsg
	}

	// Execute the analysis script
	cmd := exec.Command("node", scriptPath, tmpFile.Name())
	output, err := cmd.CombinedOutput()

	if err != nil {
		errMsg := fmt.Sprintf("Analysis failed: %v\nOutput: %s", err, string(output))
		return errMsg, errMsg, errMsg, errMsg
	}

	// Parse JSON output
	var result HerbAnalysisResult
	if err := json.Unmarshal(output, &result); err != nil {
		errMsg := fmt.Sprintf("Failed to parse analysis result: %v", err)
		return errMsg, errMsg, errMsg, errMsg
	}

	return formatParseResult(result.Parse),
		formatLexResult(result.Lex),
		formatRubyResult(result.Ruby),
		formatHTMLResult(result.HTML)
}

type HerbAnalysisResult struct {
	Parse     string  `json:"parse"`
	ParseJSON string  `json:"parseJson"`
	Lex       string  `json:"lex"`
	Ruby      string  `json:"ruby"`
	HTML      string  `json:"html"`
	Linter    string  `json:"linter"`
	Version   string  `json:"version"`
	Duration  float64 `json:"duration"`
	Success   bool    `json:"success"`
	Error     string  `json:"error,omitempty"`
}

func findHerbAnalyzerScript() string {
	// Get current working directory
	if cwd, err := os.Getwd(); err == nil {
		scriptPath := filepath.Join(cwd, "herb-analyzer.js")
		if _, err := os.Stat(scriptPath); err == nil {
			return scriptPath
		}
	}
	
	// Try relative paths
	candidates := []string{
		"./herb-analyzer.js",
		"./playground-cli/herb-analyzer.js",
		"../playground-cli/herb-analyzer.js",
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

func formatParseResult(parse string) string {
	if parse == "" || parse == "Parse failed" {
		return "❌ Parse failed"
	}

	lines := strings.Split(parse, "\n")
	result := []string{
		"🌳 Parse Result",
		"===============",
		"",
	}

	// Limit output length for better display
	maxLines := 30
	if len(lines) > maxLines {
		result = append(result, lines[:maxLines]...)
		result = append(result, fmt.Sprintf("... (%d more lines)", len(lines)-maxLines))
	} else {
		result = append(result, lines...)
	}

	return strings.Join(result, "\n")
}

func formatLexResult(lex string) string {
	if lex == "" || lex == "Lex failed" {
		return "❌ Lex failed"
	}

	lines := strings.Split(lex, "\n")
	result := []string{
		"📝 Lex Result",
		"=============",
		"",
	}

	// Limit output length for better display
	maxLines := 30
	if len(lines) > maxLines {
		result = append(result, lines[:maxLines]...)
		result = append(result, fmt.Sprintf("... (%d more lines)", len(lines)-maxLines))
	} else {
		result = append(result, lines...)
	}

	return strings.Join(result, "\n")
}

func formatRubyResult(ruby string) string {
	if ruby == "" || ruby == "No Ruby code found" {
		return "💎 No Ruby Code Found\n=====================\n\nThis ERB template contains no Ruby expressions."
	}

	lines := strings.Split(ruby, "\n")
	result := []string{
		"💎 Extracted Ruby Code",
		"======================",
		"",
	}

	result = append(result, lines...)
	return strings.Join(result, "\n")
}

func formatHTMLResult(html string) string {
	if html == "" || html == "No HTML found" {
		return "🏷️  No HTML Found\n=================\n\nThis ERB template contains no HTML content."
	}

	lines := strings.Split(html, "\n")
	result := []string{
		"🏷️  Extracted HTML",
		"==================",
		"",
	}

	result = append(result, lines...)
	return strings.Join(result, "\n")
}
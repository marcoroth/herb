package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textarea"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type Model struct {
	width         int
	height        int
	editor        textarea.Model
	outputs       map[string]string
	focused       int // 0 = editor, 1 = output
	activeTab     int // 0 = linter, 1 = parse, 2 = lex, 3 = ruby, 4 = html
	tabs          []Tab
	scrollOffset  int // for output panel scrolling
	lastContent   string
	debounceTimer *time.Timer
}

type Tab struct {
	name string
	icon string
	key  string
}

type analyzeMsg struct {
	content string
	results map[string]string
}

func NewModel() Model {
	editor := textarea.New()
	editor.Placeholder = "Enter your ERB code here..."
	editor.SetValue(`<div class="container">
  <h1>Hello, <%= @name %>!</h1>
  <% if @items.any? %>
    <ul>
      <% @items.each do |item| %>
        <li><%= item %></li>
      <% end %>
    </ul>
  <% else %>
    <p>No items found.</p>
  <% end %>
</div>`)
	editor.Focus()

	tabs := []Tab{
		{name: "Linter", icon: "🔍", key: "linter"},
		{name: "Parse", icon: "🌳", key: "parse"},
		{name: "Lex", icon: "📝", key: "lex"},
		{name: "Ruby", icon: "💎", key: "ruby"},
		{name: "HTML", icon: "🏷️", key: "html"},
	}

	outputs := make(map[string]string)
	for _, tab := range tabs {
		outputs[tab.key] = "Loading..."
	}

	model := Model{
		editor:      editor,
		outputs:     outputs,
		focused:     0,
		activeTab:   0,
		tabs:        tabs,
		lastContent: editor.Value(),
	}

	// Trigger initial analysis
	return model
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		textarea.Blink,
		m.scheduleAnalysis(),
	)
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		
		// Split screen in half
		editorWidth := m.width/2 - 2
		m.editor.SetWidth(editorWidth)
		m.editor.SetHeight(m.height - 4)

	case analyzeMsg:
		// Update outputs if this analysis is for the current content
		if msg.content == m.editor.Value() {
			for key, result := range msg.results {
				m.outputs[key] = result
			}
		}

	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c", "q":
			if m.debounceTimer != nil {
				m.debounceTimer.Stop()
			}
			return m, tea.Quit
		case "tab":
			if m.focused == 0 {
				m.focused = 1
				m.editor.Blur()
			} else {
				m.focused = 0
				m.editor.Focus()
			}
		case "left", "h":
			if m.focused == 1 && m.activeTab > 0 {
				m.activeTab--
			}
		case "right", "l":
			if m.focused == 1 && m.activeTab < len(m.tabs)-1 {
				m.activeTab++
			}
		case "1", "2", "3", "4", "5":
			if m.focused == 1 {
				tabIndex := int(msg.String()[0]) - 49 // Convert '1' to 0, '2' to 1, etc.
				if tabIndex >= 0 && tabIndex < len(m.tabs) {
					m.activeTab = tabIndex
					m.scrollOffset = 0 // Reset scroll when switching tabs
				}
			}
		case "up", "k":
			if m.focused == 1 && m.scrollOffset > 0 {
				m.scrollOffset--
			}
		case "down", "j":
			if m.focused == 1 {
				m.scrollOffset++
			}
		case "pgup":
			if m.focused == 1 {
				m.scrollOffset = max(0, m.scrollOffset-10)
			}
		case "pgdown":
			if m.focused == 1 {
				m.scrollOffset += 10
			}
		case "home":
			if m.focused == 1 {
				m.scrollOffset = 0
			}
		case "ctrl+r":
			// Force immediate analysis
			results := m.analyzeAllViews(m.editor.Value())
			for key, result := range results {
				m.outputs[key] = result
			}
			m.lastContent = m.editor.Value()
		}
	}

	if m.focused == 0 {
		oldValue := m.editor.Value()
		m.editor, cmd = m.editor.Update(msg)
		cmds = append(cmds, cmd)
		
		// Check if content changed and schedule analysis
		if m.editor.Value() != oldValue && m.editor.Value() != m.lastContent {
			cmds = append(cmds, m.scheduleAnalysis())
		}
	}

	return m, tea.Batch(cmds...)
}

func (m Model) View() string {
	if m.width == 0 {
		return "Loading..."
	}

	editorStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("62")).
		Padding(1).
		Width(m.width/2 - 2).
		Height(m.height - 10) // Account for header, help text and margins

	outputStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("205")).
		Padding(1).
		Width(m.width/2 - 2).
		Height(m.height - 10) // Account for tabs, margins, and help text

	if m.focused == 0 {
		editorStyle = editorStyle.BorderForeground(lipgloss.Color("69"))
	} else {
		outputStyle = outputStyle.BorderForeground(lipgloss.Color("212"))
	}

	// Create editor header
	editorHeader := m.renderEditorHeader()
	
	// Create tabs
	tabs := m.renderTabs()
	
	// Get current output and apply scrolling
	currentOutput := m.outputs[m.tabs[m.activeTab].key]
	scrolledOutput := m.applyScroll(currentOutput)

	editorPanel := editorStyle.Render(m.editor.View())
	outputPanel := outputStyle.Render(scrolledOutput)

	// Create the left panel with header above editor
	leftPanel := lipgloss.JoinVertical(
		lipgloss.Top,
		editorHeader,
		editorPanel,
	)

	// Create the right panel with tabs above output
	rightPanel := lipgloss.JoinVertical(
		lipgloss.Top,
		tabs,
		outputPanel,
	)

	help := lipgloss.NewStyle().
		Foreground(lipgloss.Color("241")).
		Render("Tab: Switch panels • ←→/HL: Switch tabs • ↑↓/JK: Scroll • PgUp/PgDn: Page scroll • Home: Top • Ctrl+R: Force analyze • Ctrl+C/Q: Quit")

	return lipgloss.JoinVertical(
		lipgloss.Top,
		lipgloss.JoinHorizontal(lipgloss.Left, leftPanel, rightPanel),
		help,
	)
}

func (m Model) renderTabs() string {
	var tabButtons []string

	for i, tab := range m.tabs {
		style := lipgloss.NewStyle().
			Padding(0, 1).
			Margin(0, 0).
			Background(lipgloss.Color("240")).
			Foreground(lipgloss.Color("255"))

		if i == m.activeTab {
			style = style.
				Background(lipgloss.Color("69")).
				Foreground(lipgloss.Color("255")).
				Bold(true)
		}

		if m.focused == 1 {
			if i == m.activeTab {
				style = style.Background(lipgloss.Color("212"))
			}
		}

		button := style.Render(fmt.Sprintf("%s %s", tab.icon, tab.name))
		tabButtons = append(tabButtons, button)
	}

	tabBar := lipgloss.JoinHorizontal(lipgloss.Top, tabButtons...)
	
	// Ensure tab bar fits within output panel width and add some margin
	tabBarStyle := lipgloss.NewStyle().
		Width(m.width/2 - 2).
		Align(lipgloss.Left).
		MarginBottom(1).
		MarginTop(0)
	
	return tabBarStyle.Render(tabBar)
}

func (m Model) renderEditorHeader() string {
	style := lipgloss.NewStyle().
		Padding(0, 1).
		Margin(0, 0).
		Background(lipgloss.Color("240")).
		Foreground(lipgloss.Color("255"))

	if m.focused == 0 {
		style = style.
			Background(lipgloss.Color("69")).
			Bold(true)
	}

	header := style.Render("📝 HTML+ERB File")
	
	// Ensure header fits within editor panel width and add some margin
	headerStyle := lipgloss.NewStyle().
		Width(m.width/2 - 2).
		Align(lipgloss.Left).
		MarginBottom(1).
		MarginTop(0)
	
	return headerStyle.Render(header)
}

func (m Model) scheduleAnalysis() tea.Cmd {
	return func() tea.Msg {
		// Cancel existing timer
		if m.debounceTimer != nil {
			m.debounceTimer.Stop()
		}
		
		content := m.editor.Value()
		
		// Create new timer
		timer := time.NewTimer(100 * time.Millisecond)
		m.debounceTimer = timer
		
		// Wait for timer or cancellation
		<-timer.C
		
		// Perform analysis for all views
		results := m.analyzeAllViews(content)
		
		return analyzeMsg{
			content: content,
			results: results,
		}
	}
}

func (m Model) analyzeAllViews(code string) map[string]string {
	results := make(map[string]string)
	
	// Get all analysis results from the new script
	parseResult, lexResult, rubyResult, htmlResult, linterResult := analyzeHerbViewsWithLinter(code)
	results["parse"] = parseResult
	results["lex"] = lexResult
	results["ruby"] = rubyResult
	results["html"] = htmlResult
	results["linter"] = linterResult
	
	return results
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (m Model) applyScroll(content string) string {
	if content == "" {
		return content
	}

	lines := strings.Split(content, "\n")
	availableHeight := m.height - 10 // Account for tabs, borders, and help text
	
	// Limit scroll offset to prevent scrolling past content
	maxScroll := max(0, len(lines)-availableHeight)
	scrollOffset := min(m.scrollOffset, maxScroll)
	
	// Calculate visible range
	start := scrollOffset
	end := min(len(lines), start+availableHeight)
	
	if start >= len(lines) {
		return ""
	}
	
	visibleLines := lines[start:end]
	
	// Add scroll indicator if there's more content
	result := strings.Join(visibleLines, "\n")
	if len(lines) > availableHeight {
		scrollInfo := fmt.Sprintf(" [%d-%d of %d lines]", start+1, end, len(lines))
		if len(visibleLines) > 0 {
			// Add scroll info to the last line if there's content
			lastLineIndex := len(visibleLines) - 1
			if lastLineIndex >= 0 {
				visibleLines[lastLineIndex] += scrollInfo
				result = strings.Join(visibleLines, "\n")
			}
		}
	}
	
	return result
}
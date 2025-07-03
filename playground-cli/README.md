# Herb Linter CLI Playground

A command-line interface for the Herb ERB linter and parser, built with Bubble Tea.

## Features

- **Split-pane interface**: File editor on the left, analysis output on the right
- **Syntax-aware editing**: Built-in textarea with ERB code support
- **Real-time analysis**: Press `Ctrl+R` to analyze your ERB code
- **Interactive navigation**: Use `Tab` to switch between editor and output panels

## Installation

```bash
cd playground-cli
go mod tidy
go build -o herb-playground
```

## Usage

```bash
./herb-playground
```

### Keyboard Shortcuts

- `Tab` - Switch between editor and output panels
- `←→` or `H/L` - Switch between tabs (when in output panel)
- `1-5` - Select specific tab directly (when in output panel)
- `Ctrl+R` - Force immediate analysis
- `Ctrl+C` or `Q` - Quit the application

### Tabs

The playground includes 5 tabs matching the web version:

1. **🔍 Linter** - Shows linting results and errors
2. **🌳 Parse** - Displays the parsed AST structure  
3. **📝 Lex** - Shows lexical analysis tokens
4. **💎 Ruby** - Extracted Ruby code from ERB
5. **🏷️ HTML** - Extracted HTML content

## Example

The playground comes with a sample ERB template that demonstrates:
- ERB output tags (`<%= %>`)
- ERB code tags (`<% %>`)
- Conditional logic
- Loops and iteration
- HTML structure

## Development

To run in development mode:

```bash
go run .
```

Note: This requires a TTY-enabled terminal. If running in certain environments (like CI/CD), you may need to allocate a pseudo-TTY.

## Integration

The CLI playground is designed to work alongside the existing web-based playground at https://playground.herb-tools.dev, providing a terminal-native alternative for developers who prefer command-line tools.
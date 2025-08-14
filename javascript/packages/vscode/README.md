# Using Herb with Visual Studio Code

A Visual Studio Code extension for connecting with the [Herb Language Server](https://github.com/marcoroth/herb/tree/main/javascript/packages/language-server#readme) and Language Tools for HTML+ERB files using the [Herb](https://herb-tools.dev) HTML-aware ERB parser.

[![Herb + Visual Studio Code](https://github.com/marcoroth/herb/raw/main/javascript/packages/vscode/assets/herb-vscode.png)](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp)

---

### Installation

#### Visual Studio Code

Install the [Herb LSP extension](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp) from the Visual Studio Marketplace, or [**click here to open it directly in VS Code**](vscode:extension/marcoroth.herb-lsp).

#### Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations](https://herb-tools.dev/integrations/editors) page.

## Configuration

### Linter Settings

You can configure the linter behavior through VS Code settings:

* `languageServerHerb.linter.enabled` (boolean, default: `true`) - Enable/disable the linter
* `languageServerHerb.linter.excludedRules` (string[], default: `["parser-no-errors"]`) - Array of linter rule names to exclude from diagnostics

#### Example configuration in `settings.json`:

```json
{
  "languageServerHerb.linter.enabled": true,
  "languageServerHerb.linter.excludedRules": [
    "parser-no-errors",
    "html-tag-name-lowercase"
  ]
}
```

**Note:** The `parser-no-errors` rule is excluded by default to prevent duplicate error reporting, since parser errors are already displayed through the language server's built-in diagnostics.

## Functionality

#### Diagnostics

* Missing HTML opening tags (`MissingOpeningTagError`)
* Missing HTML closing tags (`MissingClosingTagError`)
* Mismatched HTML attribute quotes (`QuotesMismatchError`)
* Ruby syntax errors (`Ruby Syntax Error`) (via [Prism](https://github.com/ruby/prism)) (`RubyParseError`)
* Mismatched HTML tag names (`TagNamesMismatchError`)
* Unclosed elements at the end of the document (`UnclosedElementError`)
* (`UnexpectedTokenError`)
* (`VoidElementClosingTagError`)

#### Formatting (coming soon)

Formatting and Auto-formatting are underway. We are planning to integrate the [Herb Formatter](https://x.com/marcoroth_/status/1936935430173471079) directly and conveniently into the Visual Studio Code extension.

#### Roadmap/Ideas

Check-out the roadmap/issues on [GitHub](https://github.com/marcoroth/herb) or suggest a new featured that you would like to see integrated into the Visual Studio Code extension.

# Using Herb with Visual Studio Code

A Visual Studio Code extension that provides HTML+ERB language support with linting, formatting, and intelligent code analysis using the [Herb](https://herb-tools.dev) HTML-aware ERB parser.

[![Herb + Visual Studio Code](https://github.com/marcoroth/herb/raw/main/javascript/packages/vscode/assets/herb-vscode.png)](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp)

---

### Installation

#### Visual Studio Code

Install the [Herb extension](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp) from the Visual Studio Marketplace, or [**click here to open it directly in VS Code**](vscode:extension/marcoroth.herb-lsp).

#### Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations](https://herb-tools.dev/integrations/editors) page.

## Configuration

The extension can be configured through VS Code settings or a `.herb.yml` file in your project root. Project configuration in `.herb.yml` takes precedence over VS Code settings.

See the [Configuration documentation](https://herb-tools.dev/configuration) for full details.

### VS Code Settings

* `languageServerHerb.linter.enabled` (boolean, default: `true`) - Enable/disable the linter
* `languageServerHerb.formatter.enabled` (boolean, default: `false`) - Enable/disable the formatter

#### Example configuration in `settings.json`:

```json
{
  "languageServerHerb.linter.enabled": true,
  "languageServerHerb.formatter.enabled": true
}
```

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

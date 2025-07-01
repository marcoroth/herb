## Herb for Visual Studio Code

A Visual Studio Code extension for connecting with the [Herb Language Server](https://github.com/marcoroth/herb/tree/main/javascript/packages/language-server#readme) and Language Tools for HTML+ERB files using the [Herb](https://herb-tools.dev) HTML-aware ERB parser.

---

### Installation

#### Visual Studio Code

Install the [Herb LSP extension](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp) from the Visual Studio Marketplace.

[![](https://github.com/marcoroth/herb/raw/main/javascript/packages/vscode/assets/herb-vscode.png)](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp)

#### Other editors

If you are looking to use Herb in another editor, check out the instruction on the [Herb Language Server](https://github.com/marcoroth/herb/tree/main/javascript/packages/language-server#readme) page.

[![](https://github.com/marcoroth/herb/raw/main/javascript/packages/vscode/assets/herb-lsp.png)](https://github.com/marcoroth/herb/tree/main/javascript/packages/language-server#readme)

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

## Running the extension locally

- Run `yarn install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the `[Extension Development Host]` instance of VSCode, open a HTML+ERB file.

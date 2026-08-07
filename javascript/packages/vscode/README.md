# Using Herb with Visual Studio Code

A Visual Studio Code extension that provides HTML+ERB language support with linting, formatting, and intelligent code analysis using the [Herb](https://herb-tools.dev) HTML-aware ERB parser.

[![Herb + Visual Studio Code](https://github.com/marcoroth/herb/raw/main/javascript/packages/vscode/assets/herb-vscode.png)](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp)

---

### Installation

#### Visual Studio Code

Install the [Herb extension](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp) from the Visual Studio Marketplace, or [**click here to open it directly in VS Code**](vscode:extension/marcoroth.herb-lsp).

#### Cursor and other VS Code forks

Install the [Herb extension](https://open-vsx.org/extension/marcoroth/herb-lsp) from the Open VSX Registry. For anything that isn't a VS Code fork, see [Other editors](#other-editors) below.

#### Other editors

If you are looking to use Herb in another editor, like Zed, Neovim, Vim, Helix, or Sublime Text, check out the instructions on the [editor integrations](https://herb-tools.dev/integrations/editors) page.

## Setup

The extension activates automatically for HTML+ERB files and starts reporting parser errors and linter offenses right away, no setup required.

VS Code recognizes `.html.erb` files through the `erb` language, which is contributed by the [Ruby LSP extension](https://marketplace.visualstudio.com/items?itemName=Shopify.ruby-lsp). Ruby LSP is a dependency of this extension and gets installed alongside it automatically.

### Fix on Save

Autocorrectable linter offenses are fixed whenever you save a file. This is enabled by default and works independently of `editor.formatOnSave`. To turn it off, add this to your `settings.json`:

```json
{
  "languageServerHerb.linter.fixOnSave": false
}
```

### Format on Save

The [Herb Formatter](https://herb-tools.dev/projects/formatter) is an experimental preview and is therefore disabled by default. To enable it and have VS Code format HTML+ERB files on save, add the following to your `settings.json`:

```json
{
  "languageServerHerb.formatter.enabled": true,
  "[erb]": {
    "editor.defaultFormatter": "marcoroth.herb-lsp",
    "editor.formatOnSave": true
  }
}
```

> **Warning**: The formatter is experimental and may potentially corrupt files. Only use it on files that can be restored via git or another version control system.

The `[erb]` block scopes both settings to HTML+ERB files only, so the formatter you use for other languages stays untouched. Herb also handles plain `.html` files. If you want Herb to format those as well, add the same `editor.defaultFormatter` to an `[html]` block.

### Project Configuration

VS Code settings are personal defaults. To share the same setup with your team, create a `.herb.yml` file in your project root using the `Herb: Create Herb Configuration` command, or the `Create .herb.yml` button in the Herb sidebar:

```yaml
# .herb.yml
linter:
  enabled: true

formatter:
  enabled: true
  indentWidth: 2
  maxLineLength: 80
```

Project configuration in `.herb.yml` takes precedence over VS Code settings. The status bar shows which of the two is currently in effect, and clicking it opens the resolved configuration.

See the [Configuration documentation](https://herb-tools.dev/configuration) for full details.

## Features

#### Diagnostics

Syntax errors are reported as you type, including missing opening and closing tags, mismatched tag names, unclosed elements and quotes, closing tags on void elements, and Ruby syntax errors (via [Prism](https://github.com/ruby/prism)).

#### Linting

The [Herb Linter](https://herb-tools.dev/projects/linter) validates HTML+ERB against a set of configurable [rules](https://herb-tools.dev/linter/rules/), covering accessibility, HTML correctness, ERB usage patterns, and Action View best practices.

#### Code Actions

* Fix a single offense, or all autocorrectable offenses in the file
* Disable a rule (or all rules) for the current line via a `herb:disable` comment
* Disable a rule project-wide by updating `.herb.yml`

#### Formatting

Whole-document and selection formatting through the [Herb Formatter](https://herb-tools.dev/projects/formatter) (experimental preview, opt-in).

#### Hover

Hover over Action View tag helpers to see their signature, documentation, and the HTML they produce, or over an HTML character reference to see its character and codepoints.

#### Completions

HTML tags, HTML character references, Action View helpers, and `tag.` / `content_tag` element names.

#### Editing

Folding ranges, matching tag highlighting, and HTML-aware comment toggling with <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>/</kbd> that knows whether the cursor is in HTML or ERB.

#### Herb Sidebar

A dedicated view container with a project-wide analysis of all HTML+ERB files, the resolved configuration, version information, and support links.

## Settings

These are personal defaults. They apply when your project has no `.herb.yml`, and they are the right place for preferences that are yours alone and shouldn't be imposed on the rest of the team.

If a `.herb.yml` exists in the project root, its configuration always takes precedence over these settings. Anything the team should agree on, like whether the formatter runs and how it indents, belongs in [`.herb.yml`](#project-configuration).

| Setting                                      | Default   | Description                                                      |
|----------------------------------------------|-----------|------------------------------------------------------------------|
| `languageServerHerb.linter.enabled`          | `true`    | Enable/disable the linter                                        |
| `languageServerHerb.linter.fixOnSave`        | `true`    | Automatically apply autocorrectable fixes on save                |
| `languageServerHerb.formatter.enabled`       | `false`   | Enable/disable the formatter (experimental)                      |
| `languageServerHerb.formatter.indentWidth`   | `2`       | Number of spaces per indentation level                           |
| `languageServerHerb.formatter.maxLineLength` | `80`      | Maximum line length before wrapping                              |
| `languageServerHerb.trace.server`            | `verbose` | Trace the communication with the language server (for debugging) |

`languageServerHerb.trace.server` is the exception: it is editor-only and is never read from `.herb.yml`.


## Commands

All commands are available from the Command Palette (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>).

| Command                           | Description                                              |
|-----------------------------------|----------------------------------------------------------|
| `Herb: Analyze Project`           | Analyze all HTML+ERB files in the project                |
| `Herb: Re-analyze File`           | Re-analyze a single file                                 |
| `Herb: Create Herb Configuration` | Create a `.herb.yml` file in the project root            |
| `Herb: Edit Herb Configuration`   | Open the project's `.herb.yml` file                      |
| `Herb: Toggle Linter`             | Enable/disable the linter                                |
| `Herb: Toggle Formatter`          | Enable/disable the formatter                             |
| `Herb: Set Indent Width`          | Set the formatter's indent width                         |
| `Herb: Set Max Line Length`       | Set the formatter's maximum line length                  |
| `Herb: Toggle Line Comment`       | Comment/uncomment the current line or selection          |
| `Herb: Toggle Block Comment`      | Comment/uncomment the current block                      |
| `Herb: Report Issue`              | Report an issue on GitHub                                |
| `Herb: Report Detailed Issue`     | Report an issue including the current file's diagnostics |
| `Herb: Report General Issue`      | Report an issue unrelated to a specific file             |

## Roadmap

Herb is under active development and the extension evolves along with the rest of the toolchain. To see what is planned, what is in progress, and what is already known to be broken:

* [Open `vscode` issues](https://github.com/marcoroth/herb/issues?q=is%3Aissue+is%3Aopen+label%3Avscode) for everything specific to this extension
* [Milestones](https://github.com/marcoroth/herb/milestones) for what is scheduled for the upcoming releases
* [Blog](https://herb-tools.dev/blog) for what shipped in the most recent releases

What we are currently working towards:

* Making the [Herb Formatter](https://herb-tools.dev/projects/formatter) reliable and fast enough to be enabled by default
* Growing the set of [linter rules](https://herb-tools.dev/linter/rules/) and the amount of offenses that can be autocorrected
* Richer language features for HTML+ERB and Rails helpers, like completions, hover, and navigation

Missing something, or ran into a bug? [Open an issue](https://github.com/marcoroth/herb/issues/new) or use the `Herb: Report Issue` command. Contributions and ideas are very welcome.

# Herb Language Server

**Package**: [`@herb-tools/language-server`](https://www.npmjs.com/package/@herb-tools/language-server)

---

[Language Server Protocol](https://github.com/Microsoft/language-server-protocol) integration for HTML-aware ERB parsing using the [Herb Parser](/projects/parser).

![Herb Language Server in action](https://github.com/marcoroth/herb/raw/main/javascript/packages/language-server/assets/herb-lsp.png)

### Installation

#### Visual Studio Code

Install the [Herb LSP extension](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp) from the Visual Studio Marketplace.

#### Cursor (Open VSX Registry)

Install the [Herb LSP extension](https://open-vsx.org/extension/marcoroth/herb-lsp) from the Open VSX Registry.

#### Zed

The Herb Language Server is part of the official [Ruby extension for Zed](https://github.com/zed-extensions/ruby). Just install the Ruby extension in Zed and you should be good to go.

Read more in the [documentation](https://zed.dev/docs/languages/ruby).

#### Neovim (using `nvim-lspconfig`)

After installing the Herb Language Server (see below), add `herb_ls` to your Neovim config (requires nvim 0.11+):

```lua
require('lspconfig')
vim.lsp.enable('herb_ls')
```

#### Sublime Text (using Sublime LSP)

After installing the Herb Language Server (see below) and [Sublime LSP](http://lsp.sublimetext.io), update the preferences for the `LSP` package:

```json
// LSP.sublime-settings
{
  "clients": {
    "herb": {
      "enabled": true,
      "command": [
        "herb-language-server",
        "--stdio"
      ],
      "selector": "text.html.ruby | text.html.rails",
      "settings": {
        "languageServerHerb.linter": {
          "enabled": true,
          "excludedRules": ["parser-no-errors"]
        }
      },
      "initializationOptions": {
        "enabledFeatures": {
          "diagnostics": true,
        },
        "experimentalFeaturesEnabled": true
      }
    }
  },
}
```

#### Manual Installation

You can use the language server in any editor that supports the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/).

###### NPM (Global)

```bash
npm install -g @herb-tools/language-server
```

###### Yarn (Global)

```bash
yarn global add @herb-tools/language-server
```

##### Run

```bash
herb-language-server --stdio
```

##### Usage

```
Usage: herb-language-server [options]

Options:

  --stdio          use stdio
  --node-ipc       use node-ipc
  --socket=<port>  use socket
```

##### NPX

Alternatively you can also run the language server directly with `npx` without installing anything:

```bash
npx @herb-tools/language-server --stdio
```

## Configuration

The language server can be configured using a `.herb-lsp/config.json` file in your project root. This file is automatically created when the language server starts if it doesn't exist.

### Formatter Configuration

You can configure formatting behavior by adding a `formatter` section to your config:

```json
{
  "version": "0.3.1",
  "createdAt": "2025-06-29T00:00:00.000Z",
  "updatedAt": "2025-06-29T00:00:00.000Z",
  "options": {
    "formatter": {
      "enabled": true,
      "indentWidth": 2,
      "maxLineLength": 80
    }
  }
}
```

#### `formatter` Options

- `enabled` (`boolean`): Enable or disable formatting for this project. Defaults to `false`.
- `indentWidth` (`number`): Number of spaces for each indentation level. Defaults to `2`.
- `maxLineLength` (`number`): Maximum line length before wrapping. Defaults to `80`.

**Note**: VS Code users can also control formatting globally through the `languageServerHerb.formatter.enabled` setting in VS Code preferences. Formatting is currently in **Beta** and disabled by default.

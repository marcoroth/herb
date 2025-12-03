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
        "languageServerHerb.linter.enabled": true
      }
    }
  }
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

##### Preview Releases

Want to try unreleased features? Use pkg.pr.new to run the language server from any commit or PR:

```bash
npx https://pkg.pr.new/@herb-tools/language-server@{commit} --stdio
```

Replace `{commit}` with a commit SHA (e.g., `0d2eabe`) or branch name (e.g., `main`). Find available previews at [pkg.pr.new/~/marcoroth/herb](https://pkg.pr.new/~/marcoroth/herb).

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

The language server can be configured using a `.herb.yml` file in your project root. This configuration is shared across all Herb tools including the linter, formatter, and language server.

See the [Configuration documentation](https://herb-tools.dev/configuration) for full details.

### Example Configuration

```yaml
# .herb.yml
linter:
  enabled: true

formatter:
  enabled: true
  indentWidth: 2
  maxLineLength: 80
```

**Note**: VS Code users can also control settings through `languageServerHerb.*` settings in VS Code preferences. Project configuration in `.herb.yml` takes precedence over editor settings.

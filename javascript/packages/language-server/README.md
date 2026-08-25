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

#### Nova

After installing the Herb Language Server (see below), install the [Herb LSP extension](https://extensions.panic.com/extensions/com.freelancing-gods/com.freelancing-gods.herb-lsp/) from the Nova Extension Library. The extension is a community plugin maintained at [pat/herb-lsp.novaextension](https://github.com/pat/herb-lsp.novaextension).

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

###### Yarn 1 (Global)

```bash
yarn global add @herb-tools/language-server
```

###### Yarn 4

Yarn 4 removed global installs, use `yarn dlx` as the server command instead:

```bash
yarn dlx -q @herb-tools/language-server --stdio
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

```yaml [.herb.yml]
linter:
  enabled: true

formatter:
  enabled: true
  indentWidth: 2
  indentStyle: space
  maxLineLength: 80
```

**Note**: VS Code users can also control settings through `languageServerHerb.*` settings in VS Code preferences. Project configuration in `.herb.yml` takes precedence over editor settings.

### Editor Settings

Some preferences are yours alone rather than the team's, so they live with your editor instead of in `.herb.yml`. The server reads them from the `languageServerHerb` section:

| Setting                     | Default   | Description                                                       |
|-----------------------------|-----------|-------------------------------------------------------------------|
| `linter.enabled`            | `true`    | Enable/disable the linter                                         |
| `linter.fixOnSave`          | `true`    | Automatically apply autocorrectable fixes on save                 |
| `formatter.enabled`         | `false`   | Enable/disable the formatter (experimental)                       |
| `formatter.indentWidth`     | `2`       | Number of spaces per indentation level                            |
| `formatter.indentStyle`     | `space`   | Character used for indentation (`space` or `tab`)                 |
| `formatter.maxLineLength`   | `80`      | Maximum line length before wrapping                               |
| `inlayHints.enabled`        | `true`    | Annotate closing tags with what they close                        |
| `inlayHints.minimumLines`   | `10`      | How far below its opening tag a closing tag must be to get a hint |
| `inlayHints.maximumClasses` | `2`       | How many of an element's classes to include in its hint           |

How you set them depends on the editor. VS Code and Cursor contribute them as `languageServerHerb.*` preferences, so you set them in your `settings.json` or through the settings UI:

```json [settings.json]
{
  "languageServerHerb.inlayHints.minimumLines": 4
}
```

Editors that keep language server settings under their own key, like Zed, pass them at startup as initialization options instead, nested rather than dotted and without the `languageServerHerb` prefix:

```json [settings.json]
{
  "lsp": {
    "herb": {
      "initialization_options": {
        "inlayHints": {
          "minimumLines": 4
        }
      }
    }
  }
}
```

Anything you leave out falls back to the default, and `.herb.yml` still wins for the settings a project can own, which is whether the linter and formatter run at all.

# Using Herb in Editors

The Herb Language Server provides intelligent language features for HTML+ERB files across multiple editors. With built-in support for diagnostics, syntax highlighting, and upcoming formatting capabilities, you can enhance your ERB development workflow in your favorite editor.

![Herb Language Server](/herb-editors.png)

## Available Integrations

- **[Cursor](/integrations/editors/cursor)** - Available through the Open VSX Registry
- **[Helix](/integrations/editors/helix)** - Terminal-based modal editor with built-in LSP support
- **[Neovim](/integrations/editors/neovim)** - LSP configuration with multiple setup options
- **[Sublime Text](/integrations/editors/sublime)** - LSP configuration using Sublime LSP
- **[Vim](/integrations/editors/vim)** - Traditional Vim integration
- **[Visual Studio Code](/integrations/editors/vscode)** - Full-featured extension available on the Visual Studio Marketplace
- **[Zed](/integrations/editors/zed)** - Built into the official Ruby extension

## Planned Support

- **[RubyMine](/integrations/editors/rubymine)** - JetBrains IDE support (not yet available)

## Manual Installation

For editors not listed above, you can use the Herb Language Server with any editor that supports the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/).

### Install globally

:::code-group

```bash [npm]
npm install -g @herb-tools/language-server
```

```bash [yarn]
yarn global add @herb-tools/language-server
```

```bash [pnpm]
pnpm add -g @herb-tools/language-server
```

```bash [bun]
bun add -g @herb-tools/language-server
```
:::

### Run the server

```bash
herb-language-server --stdio
```

### Options

```
Usage: herb-language-server [options]

Options:
  --stdio          use stdio
  --node-ipc       use node-ipc
  --socket=<port>  use socket
```

## Quick Start with NPX

Run without installing:

```bash
npx @herb-tools/language-server --stdio
```

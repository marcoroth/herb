# Herb Language Server (`@herb-tools/language-server`)

[Language Server Protocol](https://github.com/Microsoft/language-server-protocol) integration for HTML-aware ERB using the [Herb Parser](https://herb-tools.dev).

![](./assets/herb-lsp.png)

Used by the [Herb LSP](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp) Visual Studio Code extension.

## Install

```bash
npm install -g herb-language-server
```

```bash
yarn global add herb-language-server
```

## Run

```bash
herb-language-server --stdio
```

```
Usage: herb-language-server [options]

Options:

  --stdio          use stdio
  --node-ipc       use node-ipc
  --socket=<port>  use socket
```

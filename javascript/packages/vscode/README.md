# Herb LSP for VS Code (`@herb-tools/vscode`)

A Visual Studio Code extension to use the [Herb Parser](https://herb-tools.dev) for HTML+ERB files.

![](./assets/herb-lsp.png)

## Install instructions

Install the [Herb LSP extension](https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp) from the Visual Studio Marketplace.

## Functionality

TODO

## Structure

TODO

## Running the extension locally

- Run `yarn install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the `[Extension Development Host]` instance of VSCode, open a HTML+ERB file.

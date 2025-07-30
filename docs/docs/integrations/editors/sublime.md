# Using Herb with Sublime Text

Configure the Herb Language Server with Sublime Text (via [Sublime LSP](https://lsp.sublimetext.io)) for HTML+ERB development.

![Herb with Sublime Text](/herb-sublime.png)

## Installation

*These instructions assume that you have already installed [Sublime LSP](https://lsp.sublimetext.io)*

### Manual Configuration

First, install the Herb Language Server globally:

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

Then add the `herb` client via the `LSP` package preferences:

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
          "enabled": true
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

## Troubleshooting

Ensure the language server is in your PATH:
```bash
which herb-language-server
```

Check your LSP client's documentation for debugging commands.

## Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations page](/integrations/editors).

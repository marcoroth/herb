# ide-herb

[Pulsar](https://pulsar-edit.dev) / [Atom](https://atom.io) package for the [Herb Language Server](https://herb-tools.dev) — HTML+ERB language tools including diagnostics, autocomplete, and formatting.

## Prerequisites

Install the Herb Language Server globally:

```bash
npm install -g @herb-tools/language-server
```

Or use yarn, pnpm, or bun:

```bash
yarn global add @herb-tools/language-server
pnpm add -g @herb-tools/language-server
bun add -g @herb-tools/language-server
```

Verify the installation:

```bash
herb-language-server --stdio
```

## Installation

### Pulsar

```bash
ppm install ide-herb
```

### Atom

```bash
apm install ide-herb
```

## Configuration

Open **Settings > Packages > ide-herb** to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| **Language Server Path** | Absolute path to `herb-language-server`. Leave empty to use PATH. | (empty) |
| **Enable Linter** | Enable diagnostic linting. | `true` |
| **Enable Formatter** | Enable document formatting (experimental). | `false` |

## Troubleshooting

Ensure the language server is in your PATH:

```bash
which herb-language-server
```

If the server fails to start, try setting the full path in the package settings.

## Links

- [Herb Tools](https://herb-tools.dev)
- [Documentation](https://herb-tools.dev/integrations/editors/pulsar)
- [GitHub](https://github.com/marcoroth/herb)
- [Report an Issue](https://github.com/marcoroth/herb/issues)

## License

MIT

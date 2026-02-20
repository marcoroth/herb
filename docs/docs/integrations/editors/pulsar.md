---
title: Using Herb with Pulsar / Atom
head:
  - - meta
    - property: og:image
      content: /herb-editors.png
---

# {{ $frontmatter.title }}

Configure the Herb Language Server with [Pulsar](https://pulsar-edit.dev) (or Atom) for HTML+ERB development using the `ide-herb` package.

## Installation

### 1. Install the Language Server

Install the Herb Language Server globally:

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

### 2. Install the Package

:::code-group

```bash [Pulsar]
ppm install ide-herb
```

```bash [Atom]
apm install ide-herb
```
:::

## Configuration

Open **Settings > Packages > ide-herb** to configure the package. The following settings are available:

| Setting | Description | Default |
|---------|-------------|---------|
| **Language Server Path** | Absolute path to the `herb-language-server` binary. Leave empty to use the version found on your PATH. | (empty) |
| **Enable Linter** | Enable diagnostic linting via the Herb Language Server. | `true` |
| **Enable Formatter** | Enable document formatting via the Herb Formatter (experimental). | `false` |

## Troubleshooting

Ensure the language server is in your PATH:
```bash
which herb-language-server
```

If the server fails to start, try setting the absolute path to the `herb-language-server` binary in the package settings.

## Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations page](/integrations/editors).

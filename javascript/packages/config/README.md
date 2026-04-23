# Herb Configuration

**Package**: [`@herb-tools/config`](https://www.npmjs.com/package/@herb-tools/config)

---

Shared configuration utilities for Herb. Provides a unified way to load, validate, and manage configuration across the Herb ecosystem including the linter, formatter, and language server.

## Installation

:::code-group
```shell [npm]
npm add @herb-tools/config
```

```shell [pnpm]
pnpm add @herb-tools/config
```

```shell [yarn]
yarn add @herb-tools/config
```

```shell [bun]
bun add @herb-tools/config
```
:::

## Usage

### `.herb.yaml`

The configuration is stored in a `.herb.yaml` file in the project root:

```yaml [.herb.yaml]
version: 0.9.7

linter:
  enabled: true
  rules:
    erb-no-extra-newline:
      enabled: false

formatter:
  enabled: true
  indentWidth: 2
  maxLineLength: 120
```

## Configuration Hierarchy

The Herb tools follow this configuration priority:

1. **Project configuration** (`.herb.yaml` file) - Highest priority
2. **Editor settings** (VS Code workspace/user settings)
3. **Default settings** - Fallback when no other configuration exists

This allows teams to share consistent settings via `.herb.yaml` while still allowing individual developer preferences when no project configuration exists.

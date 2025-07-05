# Herb Language Service <Badge type="info" text="coming soon" />

**Package:** [`@herb-tools/language-service`](https://www.npmjs.com/package/@herb-tools/language-service)

---

HTML+ERB language service built on the Herb parser, providing a compatible API with [`vscode-html-languageservice`](https://github.com/microsoft/vscode-html-languageservice) but with HTML+ERB template understanding.

## Installation

:::code-group
```shell [npm]
npm add @herb-tools/language-service
```

```shell [pnpm]
pnpm add @herb-tools/language-service
```

```shell [yarn]
yarn add @herb-tools/language-service
```

```shell [bun]
bun add @herb-tools/language-service
```
:::

## Features

- **Native HTML+ERB Support**: Built specifically for HTML+ERB templates with deep understanding of Rails ActionView helpers.
- **Compatible API**: Drop-in replacement for [`vscode-html-languageservice`](https://github.com/microsoft/vscode-html-languageservice) with the same interface.
- **Custom Data Providers**: Supports extensible HTML data providers for framework-specific attributes.

## Usage

Replace your import to get enhanced HTML+ERB support with no code changes:

```diff
- import { getLanguageService } from 'vscode-html-languageservice'
+ import { getLanguageService } from '@herb-tools/language-service'
```

## API Compatibility

This package provides the same API as [`vscode-html-languageservice`](https://github.com/microsoft/vscode-html-languageservice).

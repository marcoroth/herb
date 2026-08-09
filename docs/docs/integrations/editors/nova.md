---
title: Using Herb with Nova
---

# {{ $frontmatter.title }}

Use the Herb Language Server in [Nova](https://nova.app) via the [Herb LSP extension](https://extensions.panic.com/extensions/com.freelancing-gods/com.freelancing-gods.herb-lsp/).

::: info Community Plugin
The Nova extension is a community plugin built and maintained by [Pat Allan](https://github.com/pat). It is developed at [pat/herb-lsp.novaextension](https://github.com/pat/herb-lsp.novaextension) and is not part of the Herb project.
:::

## Installation

First, install the Herb Language Server (v0.4.3 or newer) globally:

:::code-group

```bash [npm]
npm install -g @herb-tools/language-server
```

```bash [yarn 1]
yarn global add @herb-tools/language-server
```

```bash [yarn 4]
yarn dlx -q @herb-tools/language-server --stdio
```

```bash [pnpm]
pnpm add -g @herb-tools/language-server
```

```bash [bun]
bun add -g @herb-tools/language-server
```
:::

Then install the **Herb LSP** extension in Nova. Open **Extensions → Extension Library...**, search for "Herb LSP", and install it. Alternatively, install it directly from the [Nova Extension Library](https://extensions.panic.com/extensions/com.freelancing-gods/com.freelancing-gods.herb-lsp/).

## Configuration

The extension works out of the box once the `herb-language-server` executable is found. Two settings are available, both at a global level and at a per-project level.

- Additional `PATH` directories, so the extension can reliably detect the `herb-language-server` executable
- Auto-formatting of ERB files when they're saved

To configure global preferences, open **Extensions → Extension Library...** and select the **Preferences** tab of the Herb LSP extension. Per-project preferences are available under **Project → Project Settings...**.

If you use a version manager like `mise`, `asdf`, or `nvm`, add the directory containing the `herb-language-server` executable (or its shims) to the extension's `PATH` setting. For example, with `mise`:

```
/Users/[username]/.local/share/mise/shims
```

## Troubleshooting

Ensure the language server is installed and in your PATH:

```bash
which herb-language-server
```

If the executable can't be found, add its directory to the extension's `PATH` setting as described above.

If the language server crashes or stops responding, run the `Restart Herb LSP` command from Nova's command palette.

## Other editors

If you are looking to use Herb in another editor, check out the instructions on the [editor integrations page](/integrations/editors).

## Resources

- [Herb LSP extension in the Nova Extension Library](https://extensions.panic.com/extensions/com.freelancing-gods/com.freelancing-gods.herb-lsp/)
- [Extension source on GitHub](https://github.com/pat/herb-lsp.novaextension)
- [Report extension-specific issues](https://github.com/pat/herb-lsp.novaextension/issues)
- [Report Herb-specific issues](https://github.com/marcoroth/herb/issues)

# Herb LSP - Atom

> An Atom package for connecting with the [Herb Language Server](https://github.com/marcoroth/herb/tree/main/javascript/packages/language-server#readme) to provide HTML+ERB language tools in Atom.

## Installation

Install the package via Atom's package manager:

```bash
apm install herb-lsp-atom
```

Ensure the Herb language server is installed globally:

```bash
npm install -g @herb-tools/language-server
```

## Prerequisites

The Atom IDE services used by this package (diagnostics, hover, completions, outline, etc.)
require community UI packages. At minimum, install the indie linter and datatip packages:

```bash
apm install linter-indie atom-ide-datatip autocomplete-plus ide-outline
```

Alternatively, install the bundled Atom IDE UI package:

```bash
apm install atom-ide-ui
```

You can enable LSP debug logging in Atom’s developer console to verify the server connection:

```coffee
atom.config.set('core.debugLSP', true)
```

## Usage

The package will activate automatically for `.erb` and `.html` files and connect to the Herb Language Server to provide diagnostics and language tooling for HTML+ERB.

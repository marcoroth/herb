# Projects

Every Herb project works on the same syntax tree, so the linter, the formatter, the language server and the engine agree about what a template means. The first two groups are the ones you use in an app. The last one is for building your own tools on Herb.

## Tools

Tools you install and run against your templates.

| Project | Description |
| --- | --- |
| [Herb Linter](/projects/linter) | Finds mistakes and enforces conventions in HTML+ERB templates. |
| [Herb Formatter](/projects/formatter) | Formats HTML+ERB templates consistently. *(experimental)* |
| [Herb Language Server](/projects/language-server) | Diagnostics, hovers and formatting in VS Code, Zed, Neovim and other editors. |
| [Herb Dev Server](/projects/dev-server) | Watches your templates and patches the open page as you save. *(experimental)* |
| [Herb Dev Tools](/projects/dev-tools) | In-browser tools for inspecting and debugging rendered templates. |
| [Herb CLI](/projects/cli) | Combined command-line interface for working with HTML+ERB files. *(coming soon)* |

## Rendering

Projects that turn templates into HTML and keep it current in the browser.

| Project | Description |
| --- | --- |
| [`Herb::Engine`](/projects/engine) | HTML-aware ERB rendering engine, API-compatible with Erubi. |
| [Herb Client Runtime](/projects/client) | Updates the parts of a rendered page that changed, in place. *(experimental)* |
| [ReActionView](https://reactionview.dev) | Reactive templates, error overlays and dev tools for Rails. |

## Building on Herb

Libraries for building your own tools on the Herb syntax tree.

| Project | Description |
| --- | --- |
| [Core](/projects/core) | Shared interfaces, syntax tree node definitions and common utilities. |
| [Analysis](/projects/analysis) | Project-wide template indexes, render call sites and partial resolution. |
| [Language Service](/projects/language-service) | HTML+ERB language service with Action View tag helper support. |
| [Syntax Tree Printer](/projects/printer) | Lossless reconstruction of source from the syntax tree. |
| [Rewriter](/projects/rewriter) | Transforms syntax tree nodes and formatted strings. |
| [Highlighter](/projects/highlighter) | Syntax highlighting and diagnostic rendering with terminal color support. |
| [Config](/projects/config) | Shared configuration loading and validation across Herb tools. |
| [Minifier](/projects/minifier) | HTML+ERB template minification. |

### The parser

The Herb Parser is the foundation every project above is built on. It is written in C and available through bindings.

| Project | Description |
| --- | --- |
| [Herb Parser (C Library `libherb`)](/projects/parser) | Fast, portable, HTML-aware ERB parser written in C. |
| [Ruby Bindings](/bindings/ruby/) | Use the parser from Ruby. |
| [JavaScript/Node.js Bindings](/bindings/javascript/) | Use the parser from Node.js and the browser. |
| [Java Bindings](/bindings/java/) | Use the parser from Java. |
| [Rust Bindings](/bindings/rust/) | Use the parser from Rust. |
| [WebAssembly Build](/projects/webassembly) | Run the parser in the browser and in Node.js through WebAssembly. |

<div align="center">
  <img alt="Herb HTML+ERB Toolchain" style="height: 256px" height="256px" src="https://github.com/user-attachments/assets/d0714ee1-ca33-4aa4-aaa9-d632ba79d54a">
</div>

<h2 align="center">Herb</h2>

<h4 align="center">A modern templating language for the HTML+ERB you already have.</h4>

<div align="center">One language and toolchain that understands your HTML and Ruby together.</div><br/>

<div align="center">Lint · Format · Analyze · Render · Tooling</div><br/>

<p align="center">
  <a href="https://rubygems.org/gems/herb"><img alt="Gem Version" src="https://img.shields.io/gem/v/herb"></a>
  <a href="https://crates.io/crates/herb"><img alt="Crates.io Version" src="https://img.shields.io/crates/v/herb"></a>
  <a href="https://www.npmjs.com/package/@herb-tools/core"><img alt="npm Version" src="https://img.shields.io/npm/v/@herb-tools/core"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=marcoroth.herb-lsp"><img alt="VS Code Marketplace" src="https://img.shields.io/visual-studio-marketplace/v/marcoroth.herb-lsp"></a>
  <a href="https://open-vsx.org/extension/marcoroth/herb-lsp"><img alt="Open VSX" src="https://img.shields.io/open-vsx/v/marcoroth/herb-lsp"></a>
  <a href="https://herb-tools.dev"><img alt="Documentation" src="https://img.shields.io/badge/documentation-available-green"></a>
  <a href="https://herb-tools.dev/playground"><img alt="playground" src="https://img.shields.io/badge/playground-Try_it_in_the_browser!-green"></a>
  <a href="https://pkg.pr.new/~/marcoroth/herb"><img alt="pkg.pr.new" src="https://pkg.pr.new/badge/marcoroth/herb"></a>
  <a href="https://github.com/marcoroth/herb/blob/main/LICENSE.txt"><img alt="License" src="https://img.shields.io/github/license/marcoroth/herb"></a>
  <a href="https://github.com/marcoroth/herb/issues"><img alt="Issues" src="https://img.shields.io/github/issues/marcoroth/herb"></a>
</p>

<br/>

**Herb is a modern templating language for the HTML+ERB you already have.**

Your `.html.erb` files are already HTML+ERB. Herb reads the HTML and the Ruby in them as one document, so it can tell you about an unclosed tag, a mismatched element or a missing `%>` with the file, the line and what to change, before the page renders. The same understanding drives a linter, a formatter, a language server for your editor and `Herb::Engine`, which renders your templates the way Erubi does and escapes each value for where it sits.

With the Rails 8.2 framework defaults, Rails renders HTML templates with `Herb::Engine`. [ReActionView](https://reactionview.dev) makes those templates reactive, and brings the error overlays, the dev tools and per-tag instrumentation to the page.

## Documentation

[herb-tools.dev](https://herb-tools.dev/overview)

## Installation

Check your templates without adding anything to your project:

```sh
gem exec herb analyze
```

Add the gem:

```sh
bundle add herb
```

Run the linter and the formatter:

```sh
npx @herb-tools/linter
npx @herb-tools/formatter
```

[Installation](https://herb-tools.dev/installation) covers editors, CI and installing from a Git branch.

## Ecosystem

### Tools

| Project | Description |
| --- | --- |
| [Herb Linter](https://herb-tools.dev/projects/linter) | Finds mistakes and enforces conventions in HTML+ERB templates. |
| [Herb Formatter](https://herb-tools.dev/projects/formatter) | Formats HTML+ERB templates consistently. *(experimental)* |
| [Herb Language Server](https://herb-tools.dev/projects/language-server) | Diagnostics, hovers and formatting in VS Code, Zed, Neovim and other editors. |
| [Herb Dev Server](https://herb-tools.dev/projects/dev-server) | Watches your templates and patches the open page as you save. *(experimental)* |
| [Herb Dev Tools](https://herb-tools.dev/projects/dev-tools) | In-browser tools for inspecting and debugging rendered templates. |

### Rendering

| Project | Description |
| --- | --- |
| [`Herb::Engine`](https://herb-tools.dev/projects/engine) | HTML-aware ERB rendering engine, API-compatible with Erubi. |
| [Herb Client Runtime](https://herb-tools.dev/projects/client) | Updates the parts of a rendered page that changed, in place. *(experimental)* |
| [ReActionView](https://reactionview.dev) | Reactive templates, error overlays and dev tools for Rails. |

### Building on Herb

The Herb Parser is a fast, portable, HTML-aware ERB parser written in C, with bindings for Ruby, JavaScript, Java, Rust and WebAssembly. The [Projects page](https://herb-tools.dev/projects) lists it together with the libraries for building your own tools on the Herb syntax tree.

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/marcoroth/herb). [CONTRIBUTING.md](https://github.com/marcoroth/herb/blob/main/CONTRIBUTING.md) explains how to set up Herb for local development.

## License

This project is available as open source under the terms of the [MIT License](https://github.com/marcoroth/herb/blob/main/LICENSE.txt).

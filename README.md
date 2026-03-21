<div align="center">
  <img alt="Herb HTML+ERB Toolchain" style="height: 256px" height="256px" src="https://github.com/user-attachments/assets/d0714ee1-ca33-4aa4-aaa9-d632ba79d54a">
</div>

<h2 align="center">Herb</h2>

<h4 align="center">The modern HTML+ERB Toolchain</h4>

<div align="center">An ecosystem of powerful and seamless developer tools for HTML+ERB (HTML + Embedded Ruby) templates.</div><br/>

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

<br/><br/><br/>

## What is Herb?

**Herb** is a powerful and seamless HTML-aware ERB toolchain and an ecosystem of developer tools built specifically for **HTML+ERB** (`.html.erb`) files. It is designed to simplify and enhance the experience of working with HTML+ERB templates through precise, accurate tooling.

**Parser**

At the core of the Herb ecosystem is the **Herb Parser**, a fast, portable, and HTML-aware ERB parser written in C. The parser generates a detailed, accurate syntax tree that serves as the foundation for reliable code analysis, transformations, and developer tooling.

**Toolchain**

The Herb toolchain includes **developer tools** (CLI, language server, formatter, linter, browser dev tools), **language bindings** (for Ruby, Node.js, Java, Rust, and the Browser using WebAssembly), and **utility libraries** (language service, highlighter, minifier, printer).

All these components leverage the Herb Parser's syntax tree to provide consistent, accurate, and helpful tooling experiences.

**Engine**

`Herb::Engine` is a new, HTML-aware ERB rendering engine built on the Herb Parser. It is designed to be API-compatible with [`Erubi::Engine`](https://github.com/jeremyevans/erubi) while adding structural awareness of HTML+ERB content, enabling features like HTML validation, security checks, and precise error reporting.

The Engine powers **ReActionView** and lays the foundation for a modern view layer for Rails and other Ruby web frameworks.

| **[ReActionView](https://reactionview.dev)** <br> 🌱 A new ActionView-compatible ERB engine with modern DX, re-imagined with `Herb::Engine`. |
| --- |
| [GitHub](https://github.com/marcoroth/reactionview) · [Website](https://reactionview.dev) · [Documentation](https://reactionview.dev/overview) |

## Ecosystem

The Herb ecosystem offers multiple tools that integrate seamlessly into editors, developer environments, and CI pipelines:

| Tool | Description |
| --- | --- |
| [Herb Parser](https://herb-tools.dev/projects/parser) | Fast, portable, HTML-aware ERB parser written in C. |
| [Herb Linter](https://herb-tools.dev/projects/linter) | Static analysis to enforce best practices and identify common mistakes. |
| [Herb Formatter](https://herb-tools.dev/projects/formatter) | Automatic, consistent formatting for HTML+ERB files. *(experimental)* |
| [Herb Language Service](https://herb-tools.dev/projects/language-service) | HTML+ERB language service with ActionView tag helper support. |
| [Herb Language Server](https://herb-tools.dev/projects/language-server) | Rich editor integration for VS Code, Zed, Neovim, and more. |
| [Herb Engine](https://herb-tools.dev/projects/engine) | HTML-aware ERB rendering engine, API-compatible with Erubi. |
| [Herb Dev Tools](https://herb-tools.dev/projects/dev-tools) | In-browser dev tools for inspecting and debugging templates, shipped with ReActionView. |
| [ReActionView](https://reactionview.dev) | ActionView-compatible ERB engine with modern DX for Rails. |

You can use the Herb Parser programmatically in **Ruby**, **Java**, **Rust**, as well as in **JavaScript** via Node.js, WebAssembly, or directly in browsers.

For a complete overview of all available tools, libraries, and integrations, visit the [**Projects page**](https://herb-tools.dev/projects) on our documentation site.

## Motivation

HTML+ERB templates never really had good, accurate, and reliable tooling. While developer tooling for Ruby code improved significantly in the last few years (especially with the introduction of the new [Prism parser](https://github.com/ruby/prism)), HTML+ERB files remained underserved, lacking fundamental support like syntax checking, auto-formatting, linting, and structural understanding.

At the same time, with the rise of tools like [Hotwire](https://hotwired.dev), [Stimulus](https://stimulus.hotwired.dev), [Turbo](https://turbo.hotwired.dev), [HTMX](https://htmx.org), [Unpoly](https://unpoly.com), and [Alpine.js](https://alpinejs.dev), advanced HTML templating became increasingly relevant (again). Developers expect modern, reliable, and precise tooling, especially given the robust ecosystem available to JavaScript frameworks and libraries.

Herb was built to close this tooling gap with an HTML-aware approach, understanding both HTML structure and ERB as first-class citizens, to provide the kind of tooling modern developers expect in the age of language servers, LLMs, and AI-driven workflows.

## Command-Line Usage

Install the Herb gem via RubyGems:

```sh
gem install herb
```

### Installing from a Git branch

To test a branch before it's released (e.g. from a fork), add both `prism` and `herb` to your Gemfile:

```ruby
gem "prism", github: "ruby/prism", tag: "v1.9.0"
gem "herb", github: "fork/herb", branch: "my-branch"
```

The `prism` gem is required because Herb's native C extension compiles against
Prism's C source, which is vendored automatically during installation.

For detailed information, like how you can use Herb programmatically in Ruby and JavaScript, visit the [documentation site](https://herb-tools.dev/bindings/ruby/reference).

Basic usage to analyze all HTML+ERB files in your project:

```sh
herb analyze .
```

This will give you an overview of how the Herb Parser sees your project:
```
--- SUMMARY --------------------------------------------------------------------
Total files: 145
✅ Successful: 143 (98.6%)
❌ Failed: 0 (0.0%)
⚠️ Parse errors: 2 (1.4%)
⏱️ Timed out: 0 (0.0%)

Files with parse errors:
  - app/views/contributions/index.html.erb
  - index.html.erb

Results saved to 2025-06-29_12-16-23_erb_parsing_result_rubyevents.log
```

Lint your HTML+ERB templates:

```sh
npx @herb-tools/linter
```

Format your HTML+ERB templates:

```sh
npx @herb-tools/formatter
```



## Background and Talks

The **Herb Parser** was first introduced at [**RubyKaigi 2025**](https://rubykaigi.org/2025/presentations/marcoroth.html) in April 2025 with the talk [*Empowering Developers with HTML-Aware ERB Tooling*](https://www.rubyevents.org/talks/empowering-developers-with-html-aware-erb-tooling-rubykaigi-2025).

At [**RailsConf 2025**](https://www.rubyevents.org/events/railsconf-2025) in July 2025, the Herb ecosystem was expanded with the talk [*The Modern View Layer Rails Deserves: A Vision for 2025 and Beyond*](https://www.rubyevents.org/talks/the-modern-view-layer-rails-deserves-a-vision-for-2025-and-beyond), introducing the linter, formatter, language server, and the vision for ReActionView.

At [**Rails World 2025**](https://www.rubyevents.org/events/rails-world-2025) in September 2025, `Herb::Engine`, ReActionView, and the visual dev tools were launched with the talk [*Introducing ReActionView: An ActionView-Compatible ERB Engine*](https://www.rubyevents.org/talks/introducing-reactionview-an-actionview-compatible-erb-engine).

At [**San Francisco Ruby Conference 2025**](https://www.rubyevents.org/events/sfruby-2025) in November 2025, the keynote [*Herb to ReActionView: A New Foundation for the View Layer*](https://www.rubyevents.org/talks/keynote-herb-to-reactionview-a-new-foundation-for-the-view-layer) gave an overview of how Herb came to be, what Herb can do for you today, and how it could enable the next generation of the Rails view layer with ReActionView.

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/marcoroth/herb). Please see the [CONTRIBUTING.md](https://github.com/marcoroth/herb/blob/main/CONTRIBUTING.md) document for guidelines on how to set up Herb for local development and how to contribute to **Herb**.

## Prior Art & Inspiration

While Herb brings a fresh approach to HTML+ERB tooling, it builds upon and learns from several existing tools and approaches in the ecosystem:

- [**Tree-sitter**](https://tree-sitter.github.io/tree-sitter/)
- [**tree-sitter-embedded-template**](https://github.com/tree-sitter/tree-sitter-embedded-template)
- [**Prism Ruby Parser**](https://github.com/ruby/prism)
- [**Ruby LSP**](https://github.com/Shopify/ruby-lsp)
- [**better-html**](https://github.com/Shopify/better-html)
- [**erb_lint**](https://github.com/Shopify/erb_lint)
- [**erb-formatter**](https://github.com/nebulab/erb-formatter)
- [**erb-formatter-vscode**](https://github.com/nebulab/erb-formatter-vscode)
- [**deface**](https://github.com/spree/deface)
- [**html_press**](https://github.com/stereobooster/html_press)
- [**htmlbeautifier**](https://github.com/threedaymonk/htmlbeautifier)
- [**vscode-erb-beautify**](https://github.com/aliariff/vscode-erb-beautify)
- [**vscode-erb-linter**](https://github.com/manuelpuyol/vscode-erb-linter)
- [**syntax_tree-erb**](https://github.com/davidwessman/syntax_tree-erb)

Herb differentiates itself by being HTML-aware from the ground up, providing a unified parsing approach that understands both HTML and ERB as first-class citizens, rather than treating one as embedded within the other.

## License

This project is available as open source under the terms of the [MIT License](https://github.com/marcoroth/herb/blob/main/LICENSE.txt).

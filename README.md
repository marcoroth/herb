<div align="center">
  <img alt="Herb HTML+ERB parser" height="256px" src="https://github.com/user-attachments/assets/d0714ee1-ca33-4aa4-aaa9-d632ba79d54a">
</div>

<h2 align="center">Herb</h2>

<h4 align="center">HTML+ERB (HTML + Embedded Ruby)</h4>

<div align="center">Powerful and seamless HTML-aware ERB parsing and tooling.</div><br/>

<p align="center">
  <a href="https://rubygems.org/gems/herb"><img alt="Gem Version" src="https://img.shields.io/gem/v/herb"></a>
  <a href="https://herb-tools.dev"><img alt="Documentation" src="https://img.shields.io/badge/documentation-available-green"></a>
  <a href="https://herb-tools.dev/playground"><img alt="playground" src="https://img.shields.io/badge/playground-Try_it_in_the_browser!-green"></a>
  <a href="https://github.com/marcoroth/herb/blob/main/LICENSE.txt"><img alt="License" src="https://img.shields.io/github/license/marcoroth/herb"></a>
  <a href="https://github.com/marcoroth/herb/issues"><img alt="Issues" src="https://img.shields.io/github/issues/marcoroth/herb"></a>
</p>

<br/><br/><br/>

## What is Herb?

**Herb** is an ecosystem of developer tooling built specifically around **HTML+ERB** (`.html.erb` files). It is designed to simplify and enhance the experience of working with HTML+ERB templates through precise, accurate tooling.

At the core of Herb is the **Herb Parser**, a fast, portable, and HTML-aware ERB parser written in C. The parser generates a detailed, accurate syntax tree that serves as the foundation for reliable code analysis, transformations, and developer tooling.

The Herb ecosystem includes both low-level libraries (with bindings for Ruby and JavaScript) and high-level tools such as linters, formatters, and language servers. All these tools leverage the Herb Parser's syntax tree to provide consistent, accurate, and helpful tooling experiences.

## What Herb Can Do for You

Herb provides a complete ecosystem of HTML+ERB tooling, designed to simplify and enhance your daily workflow. Built on the **Herb Parser**, it offers multiple tools that integrate seamlessly into editors, developer environments, and CI pipelines:

- **Herb Language Server** ([available now](https://github.com/marcoroth/herb/tree/main/javascript/packages/language-server)):  
  Rich integration for editors like VS Code, Zed, Neovim, and more. It provides diagnostics and real-time feedback to keep your templates error-free.

- **Herb Formatter** ([coming soon](https://github.com/marcoroth/herb/pull/192)):  
  Automatic, consistent formatting for HTML+ERB files, reducing manual styling and enforcing a standard across projects.

- **Herb Linter** ([coming soon](https://github.com/marcoroth/herb/tree/main/javascript/packages/linter)):  
  Static analysis for your HTML+ERB templates to enforce best practices and quickly identify common mistakes.

You can use Herb programmatically in **Ruby**, as well as in **JavaScript** via Node.js, WebAssembly, or directly in browsers.

## Motiviation

HTML+ERB templates never really had good, accurate, and reliable tooling. While developer tooling for Ruby code improved significantly in the last few years (especially with the introduction of the new Prism parser), HTML+ERB files remained underserved, lacking fundamental support like syntax checking, auto-formatting, linting, and structural understanding.

At the same time, with the rise of tools like Hotwire, Stimulus, Turbo, HTMX, and Alpine.js, advanced HTML templating became increasingly relevant (again). Developers expect modern, reliable, and precise tooling, especially given the robust ecosystem available to JavaScript frameworks and libraries.

Herb was built to close this tooling gap, providing proper tooling for HTML+ERB that matches what modern developers expect in the age of language servers, LLMs, and AI-driven workflows.

## Command-Line Usage

Install the Herb gem via RubyGems:

```sh
gem install herb
```

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
  - /Users/marcoroth/Development/rubyevents/app/views/contributions/index.html.erb
  - /Users/marcoroth/Development/rubyevents/index.html.erb

Results saved to 2025-06-29_12-16-23_erb_parsing_result_rubyevents.log
```

Herb also comes with other useful commands:

```
Herb 🌿 Powerful and seamless HTML-aware ERB parsing and tooling.

Usage:
  bundle exec herb [command] [options]

Commands:
  bundle exec herb lex [file]         Lex a file.
  bundle exec herb parse [file]       Parse a file.
  bundle exec herb analyze [path]     Analyze a project by passing a directory to the root of the project
  bundle exec herb ruby [file]        Extract Ruby from a file.
  bundle exec herb html [file]        Extract HTML from a file.
  bundle exec herb playground [file]  Open the content of the source file in the playground
  bundle exec herb version            Prints the versions of the Herb gem and the libherb library.
```

For detailed information, like how you can use Herb progamatiacally in Ruby and JavaScript, visit the [documentation site](https://herb-tools.dev/bindings/ruby/reference).


## Background and Talk

**Herb** was first introduced at [**RubyKaigi 2025**](https://rubykaigi.org/2025/presentations/marcoroth.html) in April 2025 with the talk [*Empowering Developers with HTML-Aware ERB Tooling*](https://www.rubyevents.org/talks/empowering-developers-with-html-aware-erb-tooling-rubykaigi-2025).

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/marcoroth/herb). Please see the [CONTRIBUTING.md](CONTRIBUTING.md) document for guidelines on how to set up Herb for local development and how to contribute to **Herb**.

## License

This project is available as open source under the terms of the [MIT License](LICENSE.txt).

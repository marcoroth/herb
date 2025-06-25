---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Herb"
  text: "Powerful and seamless HTML-aware ERB parsing and tooling."
  tagline: "Next-generation HTML+ERB parsing for smarter developer tooling and more."

  image:
    src: /herb.svg
    alt: Herb

  actions:
    - theme: brand
      text: Documentation
      link: /bindings/ruby

    - theme: alt
      text: Playground
      link: /playground

    - theme: alt
      text: GitHub
      link: https://github.com/marcoroth/herb

features:
  - title: HTML-aware
    icon: 🧩
    details: Intelligently recognizes and navigates HTML structure within ERB templates, ensuring precise parsing across interleaved markup and Ruby code.

  - title: Built on Prism
    icon: 💎
    details: Powered by Prism, Ruby's new official default parser as of Ruby 3.4. Prism is designed to be error-tolerant and is adopted by major Ruby runtimes including CRuby, JRuby, TruffleRuby.

  - title: Error-Tolerant
    icon: 🚑
    details: Designed to handle errors gracefully, it provides accurate results even when encountering syntax errors.

  - title: Engineered for Speed
    icon: ⚡
    details: Parses input fast enough to update on every keystroke, ensuring real-time responsiveness in text editors and other tools.

  - title: Whitespace-Aware
    icon: 📏
    details: Accurately preserves spacing and formatting in the parse result.

  - title: LSP-Ready
    icon: 🔌
    details: Works seamlessly with Language Server Protocols (LSP) for a better experience in modern editors.

  - title: Precise Position Tracking
    icon: 🎯
    details: Tracks precise locations down to individual character offsets for every node and token, enabling precise debugging, annotations, and diagnostics.

  - title: Works Across Languages
    icon: 🌎
    details: Native bindings for Ruby, JavaScript/TypeScript, and other high-level programming languages.

  - title: Expanding Template Language Support
    icon: 🏗️
    details: Future updates will expand beyond ERB through a unified parser and syntax tree architecture that maintains consistent APIs across different templating languages.

---

## Why Herb Exists

Herb addresses critical gaps in the Ruby on Rails and ERB ecosystem that have hindered developer productivity and tooling capabilities for years:

### The Problem

Before Herb, working with ERB templates presented several challenges:

- **No Comprehensive Parser**: ERB lacked a robust, HTML-aware parser that could understand the interplay between HTML structure and embedded Ruby code
- **Limited Tooling**: IDE support for ERB was minimal, with basic syntax highlighting but no intelligent features like auto-completion, refactoring, or error detection
- **Fragmented Solutions**: Existing tools treated ERB as plain text or Ruby code, missing the semantic understanding of HTML context
- **Performance Issues**: Available parsing solutions were too slow for real-time editor features

### The Solution

Herb provides the foundation for next-generation ERB tooling by offering:

- **Unified AST**: A single abstract syntax tree that represents both HTML structure and ERB code blocks with precise location tracking
- **Performance-Optimized**: Built in C with Rust-like performance characteristics, enabling real-time parsing on every keystroke
- **Multi-Platform Support**: Available as Ruby gem, JavaScript packages, WebAssembly modules, and native extensions
- **Editor Integration**: VSCode extension and Language Server Protocol support for intelligent editing features

## Available Packages

Herb is distributed across multiple packages to serve different use cases and environments:

### Ruby Ecosystem

**`herb` (Ruby Gem)**
- Core Ruby library with native C extension
- Primary interface for Rails applications and Ruby tools
- Available on RubyGems.org
- Provides parsing, AST manipulation, and analysis capabilities

### JavaScript/TypeScript Ecosystem

**`@herb-tools/core`**
- Core TypeScript interfaces and shared utilities
- Base package for all JavaScript implementations
- Provides type definitions for AST nodes and parsing results

**`@herb-tools/node`**
- Native Node.js addon for maximum performance
- Uses the same C codebase as the Ruby gem
- Ideal for build tools and server-side JavaScript applications

**`@herb-tools/node-wasm`**
- WebAssembly-based parser for Node.js
- Cross-platform compatibility without native compilation
- Good performance with easier deployment

**`@herb-tools/browser`**
- WebAssembly-based parser optimized for browsers
- Enables client-side ERB parsing and analysis
- Perfect for online editors and development tools

**`@herb-tools/language-server`**
- Language Server Protocol implementation
- Provides intelligent editing features for any LSP-compatible editor
- Includes syntax highlighting, error detection, and auto-completion

### Development Tools

**`herb-lsp` (VSCode Extension)**
- Visual Studio Code extension for ERB development
- Integrates with the Herb Language Server
- Provides syntax highlighting, error detection, and IntelliSense features
- Available on the VS Code Marketplace

## Node Types and AST Structure

Herb's Abstract Syntax Tree represents ERB templates through a comprehensive set of node types:

### HTML Nodes

- **DocumentNode**: Root node containing all document children
- **HTMLElementNode**: Complete HTML elements with opening/closing tags
- **HTMLOpenTagNode**: Opening HTML tags with attributes
- **HTMLCloseTagNode**: Closing HTML tags
- **HTMLSelfCloseTagNode**: Self-closing HTML tags (e.g., `<img />`)
- **HTMLAttributeNode**: HTML attributes with name and value
- **HTMLAttributeNameNode**: Attribute names
- **HTMLAttributeValueNode**: Attribute values (may contain ERB)
- **HTMLTextNode**: Plain text content
- **HTMLCommentNode**: HTML comments
- **HTMLDoctypeNode**: Document type declarations

### ERB Content Nodes

- **ERBContentNode**: Base ERB tag content (`<% %>`, `<%= %>`, etc.)
- **ERBEndNode**: ERB end statements (`<% end %>`)

### ERB Control Flow Nodes

- **ERBIfNode**: If statements with optional else clauses
- **ERBElseNode**: Else clauses for conditionals
- **ERBUnlessNode**: Unless statements
- **ERBCaseNode**: Case statements with when clauses
- **ERBCaseMatchNode**: Case statements with pattern matching
- **ERBWhenNode**: When clauses in case statements
- **ERBInNode**: In clauses for pattern matching

### ERB Loop Nodes

- **ERBWhileNode**: While loops
- **ERBUntilNode**: Until loops
- **ERBForNode**: For loops
- **ERBBlockNode**: Generic block constructs

### ERB Exception Handling Nodes

- **ERBBeginNode**: Begin blocks with rescue/ensure clauses
- **ERBRescueNode**: Rescue clauses for exception handling
- **ERBEnsureNode**: Ensure clauses

### Utility Nodes

- **ERBYieldNode**: Yield statements
- **LiteralNode**: Literal text content
- **WhitespaceNode**: Whitespace preservation

## ERB Syntax Support

Herb provides comprehensive support for all ERB syntax variants:

### Core ERB Tags

- **Execution Tags** (`<% %>`): Execute Ruby code without output
- **Output Tags** (`<%= %>`): Execute Ruby code and output result
- **Comment Tags** (`<%# %>`): ERB comments (not rendered)
- **Raw Output Tags** (`<%== %>`): Output without HTML escaping
- **Whitespace Control** (`<%-`, `-%>`): Control whitespace around tags
- **Literal ERB** (`<%% %%>`): Output literal ERB syntax

### Control Flow Constructs

- **Conditionals**: `if`/`elsif`/`else`/`end`, `unless`/`else`/`end`
- **Case Statements**: `case`/`when`/`else`/`end`
- **Pattern Matching**: `case`/`in`/`else`/`end`
- **Loops**: `while`/`end`, `until`/`end`, `for`/`end`
- **Blocks**: Generic block constructs with `do`/`end` or `{}`
- **Exception Handling**: `begin`/`rescue`/`ensure`/`end`

### Advanced Features

- **ERB in HTML Attributes**: Dynamic attribute values and conditional attributes
- **Nested Structures**: Complex nested ERB within HTML elements
- **Rails Helpers**: Support for Rails tag helpers and form builders
- **Block Iterations**: Each loops, times loops, and custom iterators

This comprehensive syntax support ensures that Herb can parse and analyze virtually any ERB template in the wild, from simple Rails views to complex, deeply nested template structures.

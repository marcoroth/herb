---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "🌿 Herb"
  text: ""
  tagline: Seamless and powerful HTML-aware ERB parsing.

  actions:
    - theme: brand
      text: Documentation
      link: /bindings/ruby

    - theme: alt
      text: Specification
      link: /specification

    - theme: alt
      text: GitHub
      link: https://github.com/marcoroth/herb

features:
  - title: Engineered for Speed
    icon: ⚡
    details: Parses input fast enough to update on every keystroke, ensuring real-time responsiveness in text editors and other tools.

  - title: HTML-aware
    icon: 🧩
    details: Intelligently recognizes and navigates HTML structure within ERB templates, ensuring precise parsing across interleaved markup and Ruby code.

  - title: Built on Prism
    icon: 💎
    details: Powered by Prism, Ruby's new official default parser as of Ruby 3.4. Prism is designed to be error-tolerant and is adopted by major Ruby runtimes including CRuby, JRuby, TruffleRuby.

  - title: Error-Tolerant
    icon: 🚑
    details: Designed to handle errors gracefully, it provides accurate results even when encountering syntax errors.

  - title: Whitespace-Aware
    icon: 📏
    details: Accurately preserves spacing and formatting in the Abstract Syntax Tree (AST).

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
    details: Future updates will expand beyond ERB through a unified parser and AST architecture that maintains consistent APIs across different templating languages.

---

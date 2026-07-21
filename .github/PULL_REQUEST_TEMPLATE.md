## Overview

<!--
  Briefly describe what this PR does and why. What problem does it solve or what
  new functionality does it add? Add screenshots, recordings, or example output
  if they help reviewers understand the change.
-->

## Related Issue

<!--
  Link any related issues or discussions, e.g. "Closes #123" or "Refs #456".
  If there isn't one, a short note on the motivation is appreciated.
-->

## Affected Component(s)

<!-- Check all that apply. -->

- [ ] 🌿 Parser (C)
- [ ] 🔎 Linter
- [ ] 💅 Formatter
- [ ] 🧩 Language Service / Language Server
- [ ] ⚙️ Engine
- [ ] 💎 Ruby bindings / gem
- [ ] 📦 JavaScript / Node.js / WebAssembly
- [ ] ☕ Java bindings
- [ ] 🦀 Rust bindings
- [ ] 📚 Documentation
- [ ] 🛠️ Build / CI / Tooling

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that changes existing behavior)
- [ ] 📚 Documentation only
- [ ] 🧹 Refactor / internal change (no behavior change)

## Main Technical Changes

<!--
  Highlight the main technical changes, implementation details, and anything
  important for reviewers. This is where you consolidate details that help
  others quickly understand the core of the PR.
-->

## How to Test

<!--
  Describe how a reviewer can verify this change. See CONTRIBUTING.md for the
  full local development setup. Common commands:

    make all                       # build the C parser and `herb` executable
    make test && ./run_herb_tests  # run the C tests
    bundle exec rake test          # run the Ruby tests
    bin/integration                # build from scratch and run all checks
-->

## Checklist

- [ ] 🧪 Tests added or updated
- [ ] 🔨 Ran `bin/integration` locally (or the relevant test suites)
- [ ] 📚 Documentation updated (if applicable)
- [ ] 🧭 Commit messages follow the `Component: Description` convention (e.g. `Parser: Fix …`, `Linter: Add …`)

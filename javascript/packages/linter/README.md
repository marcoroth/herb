# Herb Linter

**Package**: [`@herb-tools/linter`](https://www.npmjs.com/package/@herb-tools/linter)

---

The Herb Linter provides comprehensive HTML+ERB validation with a set of configurable rules to enforce best practices and catch common errors.

## Usage

### Command Line
```bash
npx @herb-tools/linter template.html.erb
```

### Language Server Integration

The linter is automatically integrated into the [Herb Language Server](https://herb-tools.dev/projects/language-server), providing real-time validation in supported editors like VS Code, Zed, and Neovim.

## Configuration

By default, all rules are enabled. You can customize the rules by passing a custom set to the Linter constructor:

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { Linter, HTMLTagNameLowercaseRule } from "@herb-tools/linter"

await Herb.load()

// Only run specific rules
const linter = new Linter(Herb, [HTMLTagNameLowercaseRule])

// Run with no rules (disabled)
const linter = new Linter(Herb, [])

// Lint source code
const result = linter.lint(sourceCode)
```

The Linter supports three types of rules:

- **Parser/AST Rules**: Semantic validation using the parsed document tree
- **Lexer Rules**: Token-based validation using the lexer output  
- **Source Rules**: Raw text validation using the original source code

Each rule type uses its own visitor pattern for clean, extensible implementations.

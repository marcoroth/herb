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
import { Linter, HTMLTagNameLowercaseRule } from "@herb-tools/linter"

// Only run specific rules
const linter = new Linter([
  new HTMLTagNameLowercaseRule()
])

// Run with no rules (disabled)
const linter = new Linter([])
```

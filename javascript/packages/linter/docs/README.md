# Herb Linter Documentation

The Herb Linter provides comprehensive HTML+ERB validation with a set of configurable rules to enforce best practices and catch common errors.

## Usage

### Command Line
```bash
npx @herb-tools/linter template.html.erb
```

### Language Server Integration

The linter is automatically integrated into the [Herb Language Server](../../../language-server/README.md), providing real-time validation in supported editors like VS Code, Zed, and Neovim.

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

## Contributing

To add a new linter rule you can scaffold a new rule by running:

```bash
scripts/generate-rule
```

The script creates the documentation, rule stub, and test stub based on the GitHub issue (requires the `linter` label and a `Rule name: [rule-name]` line).

Alternatively, you can create one manually:

1. Create the rule class implementing the `Rule` interface
2. Add comprehensive tests in `test/rules/`
3. Add documentation in `docs/rules/`
4. Update the main linter to include the rule by default (if appropriate)

See [html-tag-name-lowercase.ts](../src/rules/html-tag-name-lowercase.ts) for an example implementation.

# Herb Linter

**Package**: [`@herb-tools/linter`](https://www.npmjs.com/package/@herb-tools/linter)

---

The Herb Linter provides comprehensive HTML+ERB validation with a set of configurable rules to enforce best practices and catch common errors.

## Usage

### Command Line
```bash
npx @herb-tools/linter template.html.erb

# Use simple output format
npx @herb-tools/linter template.html.erb --simple

# Use JSON output format
npx @herb-tools/linter template.html.erb --json

# Disable timing information
npx @herb-tools/linter template.html.erb --no-timing
```

#### JSON Output Format

The linter supports structured JSON output with the `--json` flag, useful for programmatic consumption:

```bash
npx @herb-tools/linter template.html.erb --json
```

Example output:
```json
{
  "diagnostics": [
    {
      "filename": "template.html.erb",
      "message": "File must end with trailing newline",
      "location": {
        "start": { "line": 1, "column": 21 },
        "end": { "line": 1, "column": 22 }
      },
      "severity": "error",
      "code": "erb-requires-trailing-newline",
      "source": "Herb Linter"
    }
  ],
  "summary": {
    "filesChecked": 1,
    "filesWithViolations": 1,
    "totalErrors": 1,
    "totalWarnings": 0,
    "totalViolations": 1,
    "ruleCount": 21
  },
  "timing": {
    "startTime": "2025-08-14T16:00:48.845Z",
    "duration": 27
  },
  "completed": true,
  "clean": false,
  "message": null
}
```

JSON output fields:
- `diagnostics`: Array of linting violations with location and severity
- `summary`: Statistics about the linting run (null on errors)
- `timing`: Timing information with ISO timestamp (null with `--no-timing`)
- `completed`: Whether the linter ran successfully on files
- `clean`: Whether there were no violations (null when `completed=false`)
- `message`: Error or informational message (null on success)

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

# Herb Linter

**Package**: [`@herb-tools/linter`](https://www.npmjs.com/package/@herb-tools/linter)

---

The Herb Linter provides comprehensive HTML+ERB validation with a set of configurable rules to enforce best practices and catch common errors.

## Installation

### Global Installation

:::code-group

```shell [npm]
npm install -g @herb-tools/linter
```

```shell [pnpm]
pnpm add -g @herb-tools/linter
```

```shell [yarn]
yarn global add @herb-tools/linter
```

```shell [bun]
bun add -g @herb-tools/linter
```

:::

### One-time Usage
For occasional use without installing:
```bash
npx @herb-tools/linter template.html.erb
```

### Preview Releases

Want to try unreleased features? Use pkg.pr.new to run the linter from any commit or PR:

```bash
npx https://pkg.pr.new/@herb-tools/linter@{commit} template.html.erb
```

Replace `{commit}` with a commit SHA (e.g., `0d2eabe`) or branch name (e.g., `main`). Find available previews at [pkg.pr.new/~/marcoroth/herb](https://pkg.pr.new/~/marcoroth/herb).

### Project Installation

:::code-group

```shell [npm]
npm add -D @herb-tools/linter
```

```shell [pnpm]
pnpm add -D @herb-tools/linter
```

```shell [yarn]
yarn add -D @herb-tools/linter
```

```shell [bun]
bun add -D @herb-tools/linter
```

:::

After installing as a dev dependency, initialize the configuration:

:::code-group

```shell [npm]
npx herb-lint --init
```

```shell [pnpm]
pnpm herb-lint --init
```

```shell [yarn]
yarn herb-lint --init
```

```shell [bun]
bunx herb-lint --init
```

:::

Then add a lint NPM script to your `package.json`:
```json [package.json]
{
  "scripts": {
    "herb:lint": "herb-lint"
  }
}
```

Then run the scripts:

:::code-group

```shell [npm]
npm run herb:lint
```

```shell [pnpm]
pnpm herb:lint
```

```shell [yarn]
yarn herb:lint
```

```shell [bun]
bun run herb:lint
```

:::

## Usage

### Command Line

Basic usage:
```bash
npx @herb-tools/linter
npx @herb-tools/linter app/views/
npx @herb-tools/linter template.html.erb
npx @herb-tools/linter "**/*.rhtml"
npx @herb-tools/linter "**/*.xml.erb"
```

**Initialize configuration:**
```bash
# Create a .herb.yml configuration file
npx @herb-tools/linter --init
```

#### Options

**Output Format:**
```bash
# Use detailed output (default)
npx @herb-tools/linter template.html.erb --format detailed

# Use simple output format
npx @herb-tools/linter template.html.erb --simple
# or
npx @herb-tools/linter template.html.erb --format simple

# Use JSON output format
npx @herb-tools/linter template.html.erb --json
# or
npx @herb-tools/linter template.html.erb --format json

# Use GitHub Actions output format with detailed preview (default)
# (This is enabled automatically when the GITHUB_ACTIONS environment variable is set)
npx @herb-tools/linter template.html.erb --github

# Combine GitHub Actions output with simple format
npx @herb-tools/linter template.html.erb --format=simple --github

# Combine GitHub Actions output with detailed format (explicit)
npx @herb-tools/linter template.html.erb --format=detailed --github
```

**Display Options:**
```bash
# Disable colored output
npx @herb-tools/linter template.html.erb --no-color

# Set syntax highlighting theme
npx @herb-tools/linter template.html.erb --theme github-dark

# Disable timing information
npx @herb-tools/linter template.html.erb --no-timing

# Disable line wrapping
npx @herb-tools/linter template.html.erb --no-wrap-lines

# Enable line truncation (mutually exclusive with line wrapping)
npx @herb-tools/linter template.html.erb --truncate-lines --no-wrap-lines

# Combine GitHub Actions annotations with different formats
npx @herb-tools/linter template.html.erb --format=simple --github

# Disable GitHub Actions annotations (even in GitHub Actions environment)
npx @herb-tools/linter template.html.erb --no-github
```

**Help and Version:**
```bash
# Show help
npx @herb-tools/linter --help

# Show version information
npx @herb-tools/linter --version
```

#### GitHub Actions Output Format

The linter supports GitHub Actions annotation format with the `--github` flag, which can be combined with `--format=simple` or `--format=detailed`. The `--github` flag adds GitHub Actions annotations that GitHub can parse to create inline annotations in pull requests, while also showing the regular format output for local debugging.

::: tip Tip: Running in GitHub Actions
When the `GITHUB_ACTIONS` environment variable is set (as in GitHub Actions), GitHub Actions annotations are enabled by default. You can disable them with `--no-github` if needed.
:::

```bash
# GitHub Actions annotations + detailed format (default)
npx @herb-tools/linter --github

# GitHub Actions annotations + simple format (minimal local output)
npx @herb-tools/linter --format=simple --github
```

**Example: `--github` (GitHub annotations + detailed format)**
```
::error file=template.html.erb,line=3,col=3,title=html-img-require-alt • @herb-tools/linter@0.8.2::Missing required `alt` attribute on `<img>` tag [html-img-require-alt]%0A%0A%0Atemplate.html.erb:3:3%0A%0A      1 │ <div>%0A      2 │   <span>Test content</span>%0A  →   3 │   <img src="test.jpg">%0A        │    ~~~%0A      4 │ </div>%0A

[error] Missing required `alt` attribute on `<img>` tag [html-img-require-alt]

template.html.erb:3:3

      1 │ <div>
      2 │   <span>Test content</span>
  →   3 │   <img src="test.jpg">
        │    ~~~
      4 │ </div>
```

**Example: `--format=simple --github` (GitHub annotations + simple format)**
```
::error file=template.html.erb,line=3,col=3,title=html-img-require-alt • @herb-tools/linter@0.8.2::Missing required `alt` attribute on `<img>` tag [html-img-require-alt]%0A%0A%0Atemplate.html.erb:3:3%0A%0A      1 │ <div>%0A      2 │   <span>Test content</span>%0A  →   3 │   <img src="test.jpg">%0A        │    ~~~%0A      4 │ </div>%0A

template.html.erb:
  3:3 ✗ Missing required `alt` attribute on `<img>` tag [html-img-require-alt]
```

The GitHub Actions annotations include:
- **Embedded plain-text code previews** (with `%0A` for newlines) that GitHub renders in PR comments
- **`title` property** showing the rule code and linter version for better traceability
- **Full error context** for debugging directly in GitHub's UI

The regular format output provides colorful syntax highlighting for local terminal debugging.

This approach is ideal for CI/CD workflows as it provides both GitHub integration and local debugging:

```yaml [.github/workflows/herb.yml]
name: Herb Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Herb Linter
        run: npx @herb-tools/linter
```

#### JSON Output Format

The linter supports structured JSON output with the `--json` flag, useful for programmatic consumption:

```bash
npx @herb-tools/linter template.html.erb --json
```

<details>
<summary>Example output:</summary>

```json
{
  "offenses": [
    {
      "filename": "template.html.erb",
      "message": "File must end with trailing newline",
      "location": {
        "start": { "line": 1, "column": 21 },
        "end": { "line": 1, "column": 22 }
      },
      "severity": "error",
      "code": "erb-require-trailing-newline",
      "source": "Herb Linter"
    }
  ],
  "summary": {
    "filesChecked": 1,
    "filesWithOffenses": 1,
    "totalErrors": 1,
    "totalWarnings": 0,
    "totalOffenses": 1,
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

</details>

JSON output fields:
- `offenses`: Array of linting offenses with location and severity
- `summary`: Statistics about the linting run (`null` on errors)
- `timing`: Timing information with ISO timestamp (`null` with `--no-timing`)
- `completed`: Whether the linter ran successfully on files
- `clean`: Whether there were no offenses (`null` when `completed=false`)
- `message`: Error or informational message (`null` on success)

### Disabling Rules Inline <Badge type="info" text="v0.8.0+" />

You can disable linting rules for specific lines using inline comments. This is useful when you need to allow certain code that would otherwise trigger a linting offense.

#### Disabling a Single Rule

Add a comment at the end of the line with `herb:disable` followed by the rule name:

```erb
<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
```

#### Disabling Multiple Rules

You can disable multiple rules on the same line by separating rule names with commas:

```erb
<DIV id='test' class="<%= "hello" %>">test</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
```

#### Disabling All Rules

To disable all linting rules for a specific line, use `all`:

```erb
<DIV id='test' class="<%= "hello" %>">test</DIV> <%# herb:disable all %>
```

::: warning Important
Inline disable comments only affect the line they appear on. Each line that needs linting disabled must have its own disable comment.
:::

### Disabling Linting for Entire Files <Badge type="info" text="v0.8.2+" />

You can disable linting for an entire file by adding the `ignore` directive anywhere in your template:

```erb
<%# herb:linter ignore %>
```

**Example:**

:::code-group
```erb [ignored.html.erb]
<%# herb:linter ignore %>

<DIV>
  <SPAN>This entire file will not be linted</SPAN>
</DIV>
```

```erb [regular.html.erb]
<DIV>
  <SPAN>This entire file will be linted</SPAN>
</DIV>
```
:::

::: warning Important
The `<%# herb:linter ignore %>` directive must be an exact match. Extra text or spacing will prevent it from working.
:::

## Configuration

Create a `.herb.yml` file in your project root to configure the linter:

```bash
npx @herb-tools/linter --init
```

### Basic Configuration

```yaml [.herb.yml]
linter:
  enabled: true

  # Additional glob patterns to include (additive to defaults)
  include:
    - '**/*.xml.erb'

  # Glob patterns to exclude from linting
  exclude:
    - 'vendor/**/*'
    - 'node_modules/**/*'

  rules:
    # Disable a rule
    erb-no-extra-newline:
      enabled: false

    # Change rule severity
    html-tag-name-lowercase:
      severity: warning  # error, warning, info, or hint
```

### Rule-Level File Patterns

Apply rules to specific files using `include`, `only`, and `exclude` patterns:

```yaml [.herb.yml]
linter:
  rules:
    # Apply rule only to component files
    html-img-require-alt:
      include:
        - 'app/components/**/*'
      exclude:
        - 'app/components/legacy/**/*'

    # Restrict rule to specific directory (overrides include)
    html-tag-name-lowercase:
      only:
        - 'app/views/**/*'
      exclude:
        - 'app/views/admin/**/*'
```

**Pattern precedence:**
1. `only` - When present, rule applies ONLY to these files (ignores all `include`)
2. `include` - When `only` is absent, rule applies only to these files (additive)
3. `exclude` - Always applied regardless of `include` or `only`

### Force Flag

Process files even when excluded or when linter is disabled:

```bash
# Force linting when disabled in config
herb-lint --force

# Force linting on an excluded file
herb-lint --force app/views/excluded-file.html.erb
```

When using `--force` on an excluded file, the linter will show a warning but proceed with linting.

### Custom Rules

Create custom linter rules for project-specific requirements by placing ES module files (`.mjs`) in `.herb/rules/`:

::: info File Extension
Custom rules must use the `.mjs` extension to avoid Node.js module type warnings. The `.mjs` extension explicitly marks files as ES modules.
:::

::: code-group


```js [.herb/rules/no-inline-styles.mjs]
import { BaseRuleVisitor, ParserRule } from "@herb-tools/linter"

class NoDivTagsVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node) {
    if (!node.tag_name) return
    if (node.tag_name.value !== "div") return

    this.addOffense(
      `Avoid using \`<div>\` tags. Consider using semantic HTML elements like \`<section>\`, \`<article>\`, \`<nav>\`, \`<main>\`, \`<header>\`, \`<footer>\`, or \`<aside>\` instead.`,
      node.tag_name.location
    )
  }
}

export default class NoDivTagsRule extends ParserRule {
  name = "no-div-tags"

  check(result, context) {
    const visitor = new NoDivTagsVisitor(this.name, context)
    visitor.visit(result.value)
    return visitor.offenses
  }
}
```

```js [.herb/rules/no-inline-styles.mjs]
import { BaseRuleVisitor, getAttributes, getAttributeName } from "@herb-tools/linter"

class NoInlineStylesVisitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node) {
    const attributes = getAttributes(node)

    for (const attribute of attributes) {
      const attributeName = getAttributeName(attribute)

      if (attributeName === "style") {
        this.addOffense(
          `Avoid using inline \`style\` attributes. Use CSS classes instead.`,
          attribute.location,
          "warning"
        )
      }
    }

    super.visitHTMLOpenTagNode(node)
  }
}

export default class NoInlineStylesRule {
  name = "no-inline-styles"

  check(parseResult, context) {
    const visitor = new NoInlineStylesVisitor(this.name, context)
    visitor.visit(parseResult.value)
    return visitor.offenses
  }
}
```

:::

**Rule Configuration:**

The `defaultConfig` getter is optional. If not specified, custom rules default to:
- `enabled: true` - Rule is enabled by default
- `severity: "error"` - Offenses are reported as errors
- `exclude: []` - No files are excluded

You can override the `defaultConfig` getter to customize these defaults, as shown in the example above where severity is set to `"warning"`.

**Rule Properties:**

- `static type` - Optional, defaults to `"parser"`. Can be `"parser"`, `"lexer"`, or `"source"`
- `name` - Required, the rule identifier used in configuration and output
- `check()` - Required, the method that checks for offenses
- `defaultConfig` - Optional, returns the default configuration for the rule
- `isEnabled()` - Optional, dynamically determines if the rule should run
- `autofix()` - Optional, implements automatic fixing for the rule

Custom rules are loaded automatically by default. Use `--no-custom-rules` to disable them.

When custom rules are loaded, the linter will display them:

```
Loaded 2 custom rules:
  • no-inline-styles (.herb/rules/no-inline-styles.mjs)
  • require-aria-labels (.herb/rules/require-aria-labels.mjs)
```

::: warning Rule Name Clashes
If a custom rule has the same name as a built-in rule or another custom rule, you'll see a warning. The custom rule will override the built-in rule.
:::

::: tip Hot Reload
Custom rules are automatically reloaded when changed in editors with the Herb Language Server. No need to restart your editor!
:::

### Language Server Integration

The linter is automatically integrated into the [Herb Language Server](https://herb-tools.dev/projects/language-server), providing real-time validation in supported editors like VS Code, Zed, and Neovim.

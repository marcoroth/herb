# Linter Rule: Check source is well-formatted

**Rule:** `herb-formatter-well-formatted`

## Description

This rule checks if the source code matches the output of the Herb Formatter. It shows formatting issues as diagnostics (squiggly lines in editors), allowing you to see what would change when formatting is applied.

## Configuration

This rule is **disabled by default**. To enable it, you must:

1. Enable the formatter in your `.herb.yml`
2. Enable this rule

```yaml
formatter:
  enabled: true

linter:
  rules:
    herb-formatter-well-formatted:
      enabled: true
```

The rule will only run when both conditions are met. It also respects the formatter's file exclusion patterns.

## Rationale

This rule bridges the gap between linting and formatting by surfacing formatting issues as lint warnings. This is useful when:

* You want to see formatting issues inline in your editor before running the formatter
* You want CI to fail on unformatted code without actually modifying files
* You prefer reviewing formatting changes before applying them

To fix the issues, run the Herb formatter CLI: `herb format`.

## Messages

The rule generates contextual messages based on the type of formatting issue:

* **Incorrect indentation: expected N spaces, found M** - When indentation differs
* **Unexpected whitespace** - When extra whitespace should be removed
* **Missing whitespace** - When whitespace should be added
* **Incorrect line breaks** - When line break count differs
* **Formatting differs from expected** - Generic message for other differences

## Examples

### ✅ Good

```erb
<div>
  <p>Hello</p>
</div>
```

```erb
<%= render partial: "header" %>
```

### 🚫 Bad

```erb
<div>
<p>Hello</p>
</div>
```

```erb
<div>   </div>
```

```erb
<div>
    <p>Too much indentation</p>
</div>
```

## References

- [GitHub Issue #916](https://github.com/marcoroth/herb/issues/916)

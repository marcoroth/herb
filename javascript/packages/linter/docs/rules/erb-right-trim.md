# Linter Rule: Enforces trimming with -

**Rule:**: `erb-right-trim`

Trimming at the right of an ERB tag can be done with either =%&gt; or -%&gt;, this linter enforces "-" as the default trimming style.

## Examples

### ❌ Incorrect

```erb
<%= title =%>
```

### ✅ Correct

```erb
<%= title -%>
```

## Configuration

This rule has no configuration options.

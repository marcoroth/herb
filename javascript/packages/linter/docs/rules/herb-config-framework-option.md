# Linter Rule: Require the `framework` option

**Rule:** `herb-config-framework-option`

## Description

Reports templates in a project that doesn't set `framework` in its `.herb.yml`. The rule stays quiet as soon as `framework` is set, whichever value it is set to.

When a template shows what it is rendered by, the offense says so and suggests that value. Otherwise it lists the values to choose from.

## Rationale

Herb tailors itself to the `framework` option. It decides what Herb may assume about a template, which rules apply, and which optimizations it can take. Without it Herb falls back to `ruby` and treats every template as plain ERB, which is the most conservative behavior it has.

The option is a project-level setting, and the CLI warns about it once per run, but that warning never reaches an editor. This rule brings it to where templates are actually written.

Two signals tell Herb the project is likely Action View, and both only shape the message:

- a strict locals declaration, which only Action View reads
- a call to a helper whose name is unmistakably Action View, so `link_to` and `image_tag` count while `render`, `params`, and `t` don't

Neither is a requirement for the offense. A template with no Ruby in it at all still reports, because the option is still missing.

The rule reports once per file.

## Examples

### ✅ Good

Any value silences the rule, including the `ruby` default when that is what the project means:

```yaml [.herb.yml]
framework: actionview
```

```yaml [.herb.yml]
framework: ruby
```

### 🚫 Bad

Without the option, every template reports:

```erb
<div class="card">
  <h1>Hello</h1>
</div>
```

Templates carrying an Action View signal get that value suggested:

```erb
<%= image_tag "logo.png", alt: "Logo" %>
```

```erb
<%# locals: (title:, subtitle: nil) %>
<h1><%= title %></h1>
```

## Configuration

Set the framework in your `.herb.yml` to resolve the offense:

```yaml [.herb.yml]
framework: actionview # Options: ruby (default), actionview, hanami, sinatra
```

Or disable the rule if you prefer to keep the option unset:

```yaml [.herb.yml]
linter:
  rules:
    herb-config-framework-option:
      enabled: false
```

## References

- [Herb Configuration: Framework Configuration](https://herb-tools.dev/configuration#framework-configuration)
- [Action View Helpers](https://guides.rubyonrails.org/action_view_helpers.html)

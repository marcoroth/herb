---
name: herb-erb-lint-format
description: Use when editing, creating, refactoring, renaming, or deleting `.html.erb`, `.turbo_stream.erb`, `.html.herb`, or `.rhtml` files in a Rails project that has a `.herb.yml` at the root. Also use when auditing Rails views for accessibility, security, or broken partial references, or when writing template codemods.
---

# Lint and format ERB with Herb

## Overview

This skill is the working contract for an LLM agent editing ERB inside a Rails app that already has Herb installed. The Herb toolchain provides three independent checks that all need to run after every edit: **lint** (rules), **actionview check** (partial resolution), and optionally **format**. Skipping any of them means shipping the class of bug that tool catches.

If Herb is not yet installed, use the `herb-install-rails` skill first.

## The inner loop — run after every ERB edit

For each modified `.html.erb` / `.turbo_stream.erb` / `.html.herb`:

```sh
bundle exec herb lint <file>                            # rule diagnostics
bundle exec herb actionview check <file's directory>    # partial resolution (Rails-aware)
bundle exec herb format --check <file>                  # only if formatter.enabled in .herb.yml
```

When renaming, moving, or deleting a partial, also run from the Rails root:

```sh
bundle exec herb actionview graph <partial>             # who renders this?
bundle exec herb actionview check .                     # any unresolved render calls anywhere?
```

Fix every `error` and `warning` before declaring the edit done.

## When the herb binary is missing — DO NOT give up

If `bundle exec herb` exits with "command not found", **try the npm fallback before stopping**:

```sh
npx --yes @herb-tools/linter <file>
npx --yes @herb-tools/formatter --check <file>
```

The Ruby CLI delegates to these packages anyway. If both routes fail, surface the failure to the user explicitly ("Herb is not runnable in this environment; install it before I edit further") — do not silently skip the inner loop and proceed.

**`actionview check` has NO npm fallback.** It is a Ruby-only tool that lives in the `herb` gem (it needs Rails view-path resolution). If `bundle exec herb actionview check` fails because the gem isn't installed, do **not** try to invent an npx command for it — there is no `@herb-tools/actionview` package. Surface the failure to the user: "I cannot verify partial references; the herb gem is not installed."

## Finding partial callers — DO NOT use grep

Before renaming, moving, or deleting a partial, you need to know who renders it. `grep -r 'render.*card'` looks tempting and is wrong:

- It misses `render partial: "posts/card"` (different syntax)
- It misses layouts that use the partial via `render template:`
- It can't resolve relative paths (`render "card"` vs `render "posts/card"`)
- It produces false matches in JS, CSS, and unrelated Ruby

Use the Rails-aware graph instead:

```sh
bundle exec herb actionview graph app/views/posts/_card.html.erb
```

It resolves the same way Rails does. The graph is authoritative; grep is not.

## Rule playbook

### Accessibility

| Rule | Triggers | Fix |
| --- | --- | --- |
| `html-img-require-alt` | `<img>` without `alt` | Add `alt="…"`. Use `alt=""` for purely decorative images. |
| `a11y-disabled-attribute` | `disabled` on non-form elements | Use `aria-disabled="true"`; keep `disabled` on real form controls. |
| `a11y-no-redundant-image-alt` | Alt contains "image of", "picture of"… | Drop the phrase; describe what's depicted. |

### Security

| Pattern | Fix |
| --- | --- |
| `<div <%= attr %>="…">` (ERB in attribute name) | Use `tag.div(**attrs)` or hard-code the attribute. |
| `<a href=<%= path %>>` (unquoted attribute value) | Quote it: `<a href="<%= path %>">`. |
| `<%= raw user_input %>` / `html_safe` on untrusted data | Switch to `<%= … %>` (auto-escaped) or `sanitize` with an allowlist. |

If a `raw` call is intentional, leave a one-line comment naming the trust boundary; don't disable the rule.

### Rails conventions

- Partials should declare locals: `<%# locals: (name:, …) %>`.
- Elements with `data-turbo-permanent` need a stable `id`.
- Prefer `link_to`, `button_to`, `form_with`, `tag.*` over raw HTML when a helper exists. In Rails 7+, `link_to … method: :delete` does not work without rails-ujs — use `button_to` or Turbo's `data: { turbo_method: :delete }`.

### Style

`html-tag-name-lowercase`, `erb-require-trailing-newline`, attribute ordering — safe to autofix.

### Parser errors

Fix first. Other rules can't run until the file parses. Run `bundle exec herb parse <file>` to see the syntax error.

## Autofix policy

```sh
bundle exec herb lint --fix <file>             # safe
bundle exec herb lint --fix-unsafely <file>    # may change rendered output
```

`--fix-unsafely` requires: clean `git status` for the file beforehand, `git diff` review after, and a smoke render (`bundle exec herb render <file>`) or `bin/rails test` pass.

## Inline opt-outs — last resort

```erb
<%# herb:disable rule-name %>
<bad-tag>…</bad-tag>

<%# herb:linter ignore %>   <%# whole file %>
```

Every `herb:disable` needs a one-line comment justifying it. Three or more files needing the same disable → propose a `.herb.yml` change or custom rule instead, do not paste the disable.

## Custom rules

Project-specific conventions go in `.herb/rules/*.mjs`:

```js
import { BaseRuleVisitor, ParserRule } from "@herb-tools/linter"

class Visitor extends BaseRuleVisitor {
  visitHTMLOpenTagNode(node) {
    if (node.tag_name?.value !== "div") return
    this.addOffense("Prefer a semantic element over <div>.", node.tag_name.location)
  }
}

export default class NoBareDivsRule extends ParserRule {
  static ruleName = "no-bare-divs"
  check(result, context) {
    const v = new Visitor(this.name, context)
    v.visit(result.value)
    return v.offenses
  }
}
```

Enable in `.herb.yml`:

```yaml
linter:
  rules:
    no-bare-divs: error
```

## AST codemods

When no rule expresses what you need (audits, refactors), use `Herb.parse` — never regex:

```ruby
require "herb"

Dir["app/views/**/*.html.erb"].each do |path|
  result = Herb.parse(File.read(path))
  next if result.errors.any?
  result.value.recursive_visit do |node|
    next unless node.respond_to?(:tag_name) && node.tag_name&.value == "img"
    attrs = node.attributes.to_h { |a| [a.name&.value, a.value&.value] }
    puts "#{path}: missing alt" unless attrs.key?("alt")
  end
end
```

The same AST powers `herb lint`, the LSP, and `Herb::Engine` — your visitor's results stay consistent with the rest of the toolchain.

## Red flags — STOP and run the inner loop

- "`bundle exec herb` isn't installed, so I'll skip lint" → try `npx @herb-tools/linter` first
- "The edit is one line, lint isn't worth it" → run it; one-line edits introduce a11y and security regressions
- "I'll grep for who renders this partial" → use `herb actionview graph`
- "I already ran lint on a similar file" → run it on this file
- "I'll lint all the files at the end after I'm done" → no, after every edit (each edit can introduce a parser error that masks the next)
- "Running bundle install / npx is a heavier side effect than the user asked for" → not running lint is the bigger side effect; tell the user the tool is missing and let them decide
- The agent is reaching for `grep`, `sed`, or `find` to answer a question about ERB structure → use `herb parse`, `herb actionview graph`, or an AST visitor instead

## Common rationalizations

| Excuse | Reality |
| --- | --- |
| "Command not found, so lint isn't available" | Fall back to `npx @herb-tools/linter`. Both fail → tell the user, don't silently skip. |
| "grep is faster than `actionview graph`" | grep misses `render partial:`, relative paths, and layouts. Wrong answer fast is worse than right answer slow. |
| "I'll save the lint pass for the final review" | Each edit can introduce a parse error that masks subsequent lint findings. Run after each edit. |
| "The user only asked for a delete button, not a code review" | Lint catches breakage your edit introduced (e.g. an unwrapped `<a>`, missing alt). It's part of doing the edit correctly. |
| "`link_to … method: :delete` works fine" | Not in Rails 7+ without rails-ujs. Use `button_to` or `data: { turbo_method: :delete }`. |
| "I added a `disabled` to a `<div>` — Herb will catch it" | Yes, if you run it. Run it. |

## Common failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Lint exits 0 on a file that's clearly broken | Parser error — other rules suppressed | `bundle exec herb parse <file>` to see the syntax error |
| `actionview check` reports false positives | `framework: actionview` missing from `.herb.yml` | Add it; rerun |
| Linter ignores a file | Matched by `files.exclude` | `bundle exec herb config .` to see resolved patterns |
| `npx @herb-tools/linter` errors on engine version | Node too old | Use Node 20+ |
| `--fix` rewrote unrelated whitespace | Formatter ran alongside | Run `lint --fix` and `format --check` separately |

## Reference

- Rules source: `javascript/packages/linter/src/rules.ts`
- Rule descriptions: `javascript/packages/linter/README.md`
- ActionView analyzer: `lib/herb/action_view/render_analyzer.rb`
- Ruby API: `docs/docs/bindings/ruby/reference.md`
- Full Rails guide: `HERB-IN-RAILS.md` at the repo root

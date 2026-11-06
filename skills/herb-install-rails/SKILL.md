---
name: herb-install-rails
description: Use when adding Herb to a Ruby on Rails app for the first time, when `.herb.yml` is missing in a Rails project, when the user asks to install/configure/wire up Herb, the Herb linter, ActionView render checking, or ReActionView, or when CI for ERB templates needs to be set up in a Rails repo.
---

# Install Herb in a Rails app

## Overview

Herb is a **hybrid Ruby + Node** toolchain. The `herb` gem ships the CLI, parser, and `Herb::Engine`. The `@herb-tools/*` npm packages ship the linter, formatter, and language server. **`bundle exec herb lint` and `bundle exec herb format` delegate to the npm packages over `npx`.** A Rails CI workflow that only sets up Ruby will silently misbehave — Node must be installed too.

A single `.herb.yml` configures every tool: CLI, LSP, formatter, linter, `Herb::Engine`, ReActionView.

## Three things that get installed wrong without this skill

1. **`framework: actionview` is missing from `.herb.yml`.** Without it, `herb actionview check` (the tool that catches broken partial references) does not work. This is the single most important Rails-specific config key.
2. **CI runs `herb lint` only.** `herb lint` is HTML/ERB rule checking. **Broken partial references are a different tool: `herb actionview check`.** Both belong in CI.
3. **CI sets up Ruby but not Node.** Because the linter delegates to `@herb-tools/linter` via `npx`, Node 20+ is required in the CI runner.

Do not hand-author `.herb.yml`. Use the writer script below.

## Lint vs ActionView check — they are different

| Tool | Catches | Run in CI? |
| --- | --- | --- |
| `bundle exec herb lint` or `npx @herb-tools/linter` | HTML correctness, a11y, security, ERB rules, formatting | Yes |
| `bundle exec herb actionview check .` (Ruby-only — no npm equivalent) | Unresolved `render "foo/bar"` calls, missing partials, unused partials, render cycles | Yes (independent step) |
| `bundle exec herb analyze .` | Parse errors across the project | Optional smoke step |

If only one is in CI, broken partials WILL ship to production.

## Workflow

### 1. Preflight

Run the doctor. It reports state and never writes anything.

```sh
skills/herb-install-rails/bin/herb-rails-doctor
```

Confirms Rails root, Ruby/Bundler/Node/npx, existing Herb state. Exit 0 = continue. Exit 2 = not a Rails app, stop.

### 2. Pick a profile

| Profile | Adds |
| --- | --- |
| `minimal` | `gem "herb"` + `.herb.yml` (`framework: ruby`). No CI, no actionview. Rarely the right choice for a Rails app. |
| `recommended` | `gem "herb"` + `.herb.yml` with `framework: actionview` + GitHub Actions workflow that runs **both** lint and `actionview check`, **with Node setup**. Default. |
| `full` | `recommended` + `gem "reactionview"` (experimental: compile-time HTML/security/a11y validation with in-browser overlay). |

Default to `recommended`. Pick `full` only if the user explicitly opts into ReActionView.

### 3. Apply

```sh
skills/herb-install-rails/bin/herb-rails-setup --profile=recommended
```

Idempotent. Edits the Gemfile, runs `bundle install` (non-blocking — config still writes if bundle fails), writes `.herb.yml` via the merge-without-clobber writer, drops `.github/workflows/herb.yml` (which sets up both Ruby AND Node 20, then runs both lint and actionview check), creates `.herb/rules/` for custom rules.

### 4. Verify

```sh
skills/herb-install-rails/bin/herb-rails-doctor
bundle exec herb config .         # prints the resolved .herb.yml
bundle exec herb analyze .        # surfaces existing parse errors (not a setup failure)
bundle exec herb actionview check .   # surfaces existing broken partial refs (not a setup failure)
```

Existing parse errors and broken partials are a backlog to report to the user, not a sign the install failed.

## Red flags — stop and re-check

- `.herb.yml` does not contain `framework: actionview` (and the project is a Rails app)
- The CI workflow runs only `herb lint` (no `actionview check`)
- The CI workflow sets up Ruby but not Node
- You're hand-writing `.herb.yml` instead of running the writer script
- You're guessing the YAML schema instead of reading `lib/herb/defaults.yml` or running the writer
- You're inventing rule names like `erb-no-missing-partial` (the real tool is `actionview check`, not a lint rule)
- The init command you're about to run is `herb init` — that's not the canonical entry point; the writer script or `npx @herb-tools/linter --init` is

Any of these → stop, run `bin/herb-rails-setup --profile=recommended`.

## Common rationalizations

| Excuse | Reality |
| --- | --- |
| "The Ruby gem alone is enough; no Node needed" | `herb lint` / `herb format` delegate to npm packages via npx. CI without Node will not lint correctly. |
| "`herb lint` will catch broken partials" | No. `herb lint` is rule-based. Broken partials are caught by `bundle exec herb actionview check`. Both go in CI. |
| "I'll write the `.herb.yml` by hand — it's just YAML" | The schema is non-obvious (`files.include` is top-level, not nested; `framework: actionview` is mandatory for Rails). Use the writer. |
| "ReActionView is part of the basic install" | It's a separate gem and experimental. Only ship it in the `full` profile when the user opts in. |
| "bundle install failed, so the install failed" | The setup script intentionally continues — `.herb.yml` and CI still get written. Surface the bundle failure to the user; don't wipe progress. |

## Rollback

```sh
skills/herb-install-rails/bin/herb-rails-setup --uninstall
```

Removes only what this skill created: the gem lines (matched by the marker comment), `.herb.yml`, `.github/workflows/herb.yml`, and `.herb/rules/` if it's empty.

## Hand-off

Tell the user, in this order:

1. The CI workflow runs lint **and** actionview check on every push/PR. Node 20 is required in the workflow (already configured).
2. Local commands: `bundle exec herb lint`, `bundle exec herb actionview check .`, `bundle exec herb analyze .`.
3. Editor LSP: install the Herb extension for VS Code/Cursor; Zed bundles it in the Ruby extension; Neovim uses `herb_ls` via `nvim-lspconfig`.
4. (Full profile only) ReActionView shifts validation to compile time with an in-browser overlay — still experimental.

## Reference

- Full Rails+Herb usage guide: `HERB-IN-RAILS.md` at the repo root.
- Canonical config defaults: `lib/herb/defaults.yml`.
- ActionView analyzer source: `lib/herb/action_view/render_analyzer.rb`.
- Once Herb is installed, use the `herb-erb-lint-format` skill for the editing inner loop.

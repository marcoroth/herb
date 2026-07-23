---
title: Using Herb with GitHub Actions
---

# GitHub Actions

The linter auto-detects GitHub Actions via the `GITHUB_ACTIONS` environment variable and emits inline PR annotations by default — no extra flag required.

## Lint + Format check

```yaml [.github/workflows/herb.yml]
name: Herb

on:
  push:
    branches: [main]
  pull_request:

jobs:
  herb:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Lint HTML+ERB templates
        run: npx --yes @herb-tools/linter

      - name: Check HTML+ERB formatting
        run: npx --yes @herb-tools/formatter --check app/views
```

The formatter requires an explicit path in CI — without one it reads from stdin, which `--check` rejects. Adjust `app/views` to match where your templates live.

::: warning Formatter is in experimental preview
`@herb-tools/formatter` prints an experimental-preview banner on every invocation, and `--check` will fail on any codebase that hasn't already been run through `herb-format`. Before wiring this step into CI, see [Adopting the formatter](#adopting-the-formatter) below.
:::

## Adopting the formatter

`--check` only passes on an already-formatted tree. Run the formatter once, commit the result in its own change, then enable the CI step:

```bash
npx --yes @herb-tools/formatter app/views
```

Review the diff, commit it separately from unrelated changes, and only then add the `--check` step to your workflow.

## Stricter lint gate

Fail the build on warnings in addition to errors:

```yaml
- name: Lint HTML+ERB templates
  run: npx --yes @herb-tools/linter --fail-level warning
```

## Parser analysis (Ruby)

`herb analyze` reports how many templates parse cleanly and exits non-zero when any issue is detected (see `lib/herb/cli.rb`), so it can gate the build on its own.

Append these steps to the `herb` job above to also run the parser analyzer, or put them in a separate job if you prefer to parallelize:

```yaml
- uses: ruby/setup-ruby@v1
  with:
    bundler-cache: true

- name: Analyze HTML+ERB templates
  run: bundle exec herb analyze .
```

::: tip
If your project doesn't have `herb` in its `Gemfile`, replace `bundle exec herb` with `gem install herb && herb analyze .`, and drop `bundler-cache: true` from `ruby/setup-ruby` unless another step in the job needs it.
:::

## See also

- [Reviewdog](/integrations/ci/reviewdog) — post linter findings as inline PR review comments

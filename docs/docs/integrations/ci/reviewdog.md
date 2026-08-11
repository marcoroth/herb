---
title: Using Herb with Reviewdog
---

# Reviewdog

[Reviewdog](https://github.com/reviewdog/reviewdog) posts linter findings as inline review comments on pull and merge requests across GitHub, GitLab, and other providers.

The linter's `--format=simple` output is human-oriented (file on one line, then indented `line:col  message`) and isn't well-suited to reviewdog's `errorformat` parser. Use `--json` and transform it to [`rdjson`](https://github.com/reviewdog/reviewdog#rdjson) with `jq` instead — the JSON shape is documented in the [Linter README](/projects/linter) and source of truth for the transform below.

## GitHub Actions

::: v-pre
```yaml [.github/workflows/herb-reviewdog.yml]
name: Herb (reviewdog)

on: [pull_request]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  herb:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24

      - uses: reviewdog/action-setup@v1

      - name: Run Herb linter via reviewdog
        env:
          REVIEWDOG_GITHUB_API_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          { npx --yes @herb-tools/linter --no-github --json || true; } \
            | jq -e '
                if .completed != true then
                  error(.message // "Herb linter failed")
                else
                  {
                    source: { name: "herb-lint" },
                    diagnostics: [ .offenses[] | {
                      message: .message,
                      location: {
                        path: .filename,
                        range: {
                          start: { line: .location.start.line, column: .location.start.column },
                          end:   { line: .location.end.line,   column: .location.end.column }
                        }
                      },
                      severity: (
                        if .severity == "error" then "ERROR"
                        elif .severity == "warning" then "WARNING"
                        else "INFO"
                        end
                      ),
                      code: { value: .code }
                    }]
                  }
                end
              ' \
            | reviewdog \
                -f=rdjson \
                -name="herb-lint" \
                -reporter=github-pr-review \
                -fail-level=error
```
:::

::: tip
GitHub Actions enables Bash's `pipefail` option, so the command neutralizes the linter's offense exit status before passing its output to reviewdog. `jq -e` still fails the step if the linter did not produce a completed result. Reviewdog's `-fail-level` then decides whether reported diagnostics fail the step.
:::

## Severity mapping

The linter emits `error`, `warning`, `info`, and `hint` severities. Reviewdog's `rdjson` accepts `ERROR`, `WARNING`, and `INFO`, so the example maps Herb's `info` and `hint` severities to `INFO`:

```jq
severity: (
  if   .severity == "error"   then "ERROR"
  elif .severity == "warning" then "WARNING"
  else "INFO" end
)
```

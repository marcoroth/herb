---
title: Using Herb with Reviewdog
---

# Reviewdog

[Reviewdog](https://github.com/reviewdog/reviewdog) posts linter findings as inline review comments on pull and merge requests across GitHub, GitLab, and other providers.

The linter's `--format=simple` output is human-oriented (file on one line, then indented `line:col  message`) and isn't well-suited to reviewdog's `errorformat` parser. Use `--json` and transform it to [`rdjson`](https://github.com/reviewdog/reviewdog#rdjson) with `jq` instead — the JSON shape is documented in the [Linter README](/projects/linter) and source of truth for the transform below.

## GitHub Actions

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
          node-version: 20
      - uses: reviewdog/action-setup@v1

      - name: Run Herb linter via reviewdog
        env:
          REVIEWDOG_GITHUB_API_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          npx --yes @herb-tools/linter --no-github --json \
            | jq '{
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
                  severity: (.severity | ascii_upcase),
                  code: { value: .code }
                }]
              }' \
            | reviewdog -f=rdjson -name="herb-lint" -reporter=github-pr-review -fail-level=error
```

::: tip
The linter exits non-zero when offenses are found, but reviewdog's own `-fail-level` is what decides whether the CI step fails. Bash pipelines return the last command's exit code by default, so reviewdog's exit code wins.
:::

## Severity mapping

The linter emits `error`, `warning`, `info`, and `hint` severities. Reviewdog's `rdjson` accepts `ERROR`, `WARNING`, and `INFO`. The jq snippet above uppercases the severity string directly, which works for `error`/`warning`/`info`; `hint` is not a valid rdjson severity and will be rejected. If you use hint-level rules, map them explicitly:

```jq
severity: (
  if   .severity == "error"   then "ERROR"
  elif .severity == "warning" then "WARNING"
  else "INFO" end
)
```

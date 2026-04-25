---
title: Using Herb with GitLab CI
---

# GitLab CI

GitLab doesn't consume GitHub-style annotations, so pass `--no-github` to keep output readable in job logs.

## Lint, format, and analyze

```yaml [.gitlab-ci.yml]
herb:lint:
  image: node:20
  script:
    - npx --yes @herb-tools/linter --no-github --fail-level warning

herb:format:
  image: node:20
  script:
    - npx --yes @herb-tools/formatter --check app/views

herb:analyze:
  image: ruby:3.3
  script:
    - gem install herb
    - herb analyze .
```

`herb analyze` exits non-zero when issues are detected, so no extra gating is needed.

::: warning Formatter is in experimental preview
`@herb-tools/formatter` is in early development, and `--check` will fail on any codebase that hasn't already been run through `herb-format`. Run `npx --yes @herb-tools/formatter app/views` once and commit the result before enabling the `herb:format` job.
:::

## Code Quality report

GitLab's [Code Quality report](https://docs.gitlab.com/ee/ci/testing/code_quality.html) expects a specific JSON schema (`description`, `check_name`, `fingerprint`, `severity`, `location.path`, `location.lines.begin`). The linter's `--json` output isn't in that shape, so transform it with `jq`:

```yaml
herb:lint:
  image: node:20
  before_script:
    - apt-get update && apt-get install -y jq
  script:
    - npx --yes @herb-tools/linter --no-github --json > herb-lint.raw.json || true
    - |
      jq '[ .offenses[] | {
        description: .message,
        check_name: .code,
        fingerprint: (.filename + ":" + .code + ":" + (.location.start.line|tostring) + ":" + (.location.start.column|tostring)),
        severity: (if .severity == "error" then "major" elif .severity == "warning" then "minor" else "info" end),
        location: { path: .filename, lines: { begin: .location.start.line } }
      }]' herb-lint.raw.json > gl-code-quality-report.json
  artifacts:
    when: always
    reports:
      codequality: gl-code-quality-report.json
```

The `|| true` keeps the job running so the `jq` step still emits the report when the linter exits non-zero. Fail the pipeline on findings in a separate job if you want gating.

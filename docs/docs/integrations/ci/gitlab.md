---
title: Using Herb with GitLab CI
---

# GitLab CI

GitLab doesn't consume GitHub-style annotations, so pass `--no-github` to keep output readable in job logs.

## Lint, format, and analyze

```yaml [.gitlab-ci.yml]
herb:lint:
  image: node:24
  script:
    - npx --yes @herb-tools/linter

herb:format:
  image: node:24
  script:
    - npx --yes @herb-tools/formatter

herb:analyze:
  image: ruby:4.0
  script:
    - gem install herb
    - herb analyze .
```

`herb analyze` exits non-zero when issues are detected, so no extra gating is needed.

## Test reports

GitLab shows [JUnit test reports](https://docs.gitlab.com/ci/testing/unit_test_reports/) in merge requests and pipelines. Use `--format junit` to report linter offenses as failing tests, and `--output-file` to keep the readable output in the job log:

```yaml [.gitlab-ci.yml]
herb:lint:
  image: node:24
  script:
    - npx --yes @herb-tools/linter --format detailed --format junit --output-file herb-lint.xml
  artifacts:
    when: always
    reports:
      junit: herb-lint.xml
```

::: warning Formatter is in experimental preview
`@herb-tools/formatter` is in early development, and `--check` will fail on any codebase that hasn't already been run through `herb-format`. Run `npx --yes @herb-tools/formatter app/views` once and commit the result before enabling the `herb:format` job.
:::


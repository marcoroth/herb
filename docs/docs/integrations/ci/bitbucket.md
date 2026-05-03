---
title: Using Herb with Bitbucket Pipelines
---

# Bitbucket Pipelines

Run lint, format check, and analyzer as parallel steps.

::: warning Formatter is in experimental preview
`@herb-tools/formatter` is in early development, and `--check` will fail on any codebase that hasn't already been run through `herb-format`. Run `npx --yes @herb-tools/formatter app/views` once and commit the result before enabling the format step.
:::

```yaml [bitbucket-pipelines.yml]
image: node:20

pipelines:
  default:
    - parallel:
        - step:
            name: Herb Lint
            script:
              - npx --yes @herb-tools/linter --fail-level warning
        - step:
            name: Herb Format Check
            script:
              - npx --yes @herb-tools/formatter --check app/views
        - step:
            name: Herb Analyze
            image: ruby:3.3
            script:
              - gem install herb
              - herb analyze .
```

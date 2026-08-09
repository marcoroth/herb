---
title: Using Herb with Git Hooks
---

# Git Hooks

Run the Herb [Linter](/projects/linter) and [Formatter](/projects/formatter) in a pre-commit hook to catch unformatted templates and lint offenses before they land in the repository.

## Plain pre-commit hook

Create an executable hook script and point git at the directory containing it. Keeping hooks in a versioned directory such as `.git-hooks/` shares them with everyone who clones the repository.

```shell [.git-hooks/pre-commit]
#!/bin/sh

set -e

node_modules/.bin/herb-lint
node_modules/.bin/herb-format --check
```

```bash
chmod +x .git-hooks/pre-commit
git config core.hooksPath .git-hooks
```

Without arguments both tools run on all files configured in `.herb.yml`. Pass paths to narrow the run, for example `herb-format --check app/views`.

The hooks call `node_modules/.bin/` directly rather than `npx`. A missing install then fails immediately instead of npx falling back to fetching the package from the registry, and the hook skips npx's resolution overhead on every commit. Git always runs hooks from the repository root, so the relative path is reliable.

Prefer `--check` over the writing mode inside a plain hook. A hook that formats in place leaves the rewritten files unstaged, so the commit would still contain the unformatted version. When the check fails, run `herb-format`, review the changes, stage them, and commit again.

::: info Formatter releases up to 0.10.3
Older releases of `@herb-tools/formatter` mistook the hook environment for piped stdin input, so `herb-format` without arguments either failed with `--check mode is not supported with stdin` or silently formatted nothing. On those versions, pass an explicit path such as `herb-format --check .` as a workaround.
:::

## Husky

With [Husky](https://typicode.github.io/husky/) managing the hooks:

```bash
npm install --save-dev husky
npx husky init
```

```shell [.husky/pre-commit]
node_modules/.bin/herb-lint
node_modules/.bin/herb-format --check
```

## lint-staged

[lint-staged](https://github.com/lint-staged/lint-staged) runs the tools only on the staged files and adds the modifications its tasks make back to the commit, which makes the writing mode safe to use:

```json [package.json]
{
  "lint-staged": {
    "*.html.erb": [
      "herb-format",
      "herb-lint"
    ]
  }
}
```

Call it from whichever hook you set up above:

```shell [.git-hooks/pre-commit]
#!/bin/sh

set -e

node_modules/.bin/lint-staged
```

lint-staged appends the staged file paths to each command, so both tools only ever see the files going into the commit.

## Lefthook

[Lefthook](https://lefthook.dev) manages the hooks and filters to staged files on its own, so it covers what Husky and lint-staged do together. It ships as both a gem and an npm package:

```bash
bundle add lefthook --group development
bundle exec lefthook install
```

`{staged_files}` expands to the staged paths matching `glob`, and the commands are skipped entirely when nothing matches:

```yaml [lefthook.yml]
pre-commit:
  parallel: true
  commands:
    herb-lint:
      run: node_modules/.bin/herb-lint {staged_files}
    herb-format:
      run: node_modules/.bin/herb-format --check {staged_files}
```

To format instead of checking, drop `--check` and set `stage_fixed` so the rewritten files are added back to the commit:

```yaml [lefthook.yml]
pre-commit:
  commands:
    herb-format:
      run: node_modules/.bin/herb-format {staged_files}
      stage_fixed: true
```

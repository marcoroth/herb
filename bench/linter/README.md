# bench/linter

Whole-corpus benchmark of `@herb-tools/linter` vs [Shopify/erb_lint][erb_lint]
over the [marcoroth/herb-corpus][herb-corpus] corpus.

Only the rules with a 1:1 equivalent in both tools are enabled, so the two
runs do comparable work. The full mapping is in [`run.rb`](./run.rb) as
`RULE_MAP` and is mirrored in [`.erb_lint.yml`](./.erb_lint.yml).

## Prerequisites

- Node (for `herb-lint`)
- Built `@herb-tools/linter`:
  ```
  yarn workspace @herb-tools/linter build
  ```
- Ruby + Bundler (erb_lint is installed on demand into `bench/linter/vendor/`)

## Run

From the repo root:

```
ruby bench/linter/run.rb
```

By default this lints a deterministic 10% sample of the corpus (~3,700
files). Both tools see exactly the same file list, written to
`bench/tmp/linter-sample.txt` for inspection.

Tune the sample:

```
BENCH_LINTER_SAMPLE=0.05 ruby bench/linter/run.rb   # 5% of corpus
BENCH_LINTER_SAMPLE=1.0  ruby bench/linter/run.rb   # whole corpus
BENCH_LINTER_SEED=42     ruby bench/linter/run.rb   # different sample
```

The first invocation clones the corpus into `bench/tmp/herb-corpus/`
(~57 MB, blobless, one-time) and installs erb_lint locally. Subsequent runs
reuse both.

## Output

- Wall time for each tool over the whole corpus
- Total offense count for each tool
- Per-rule offense counts side by side, so you can spot divergences to
  investigate (a rule pair with wildly different counts is either a
  semantic gap or a real bug worth filing)

Neither tool is expected to report the same numbers by construction — this
benchmark surfaces where they differ so we can decide whether to tighten
Herb's rule or add coverage.

## Updating the rule map

`RULE_MAP` in `run.rb` and the `linters:` block in `.erb_lint.yml` must stay
in sync. When adding a rule, add it to both.

[erb_lint]: https://github.com/Shopify/erb_lint
[herb-corpus]: https://github.com/marcoroth/herb-corpus

# herb-analysis

## Requirements

- Rust **1.89.0+** (rubydex declares `rust-version = "1.89.0"`)

## Build and run

```bash
cd rust && cargo build -p herb-analysis
./bin/herb-analysis --help
```

```
smoke                                        in-memory indexing check, no filesystem needed
helpers   <paths...> --roots A,B              helper set
          [--oracle [--gem G] [--public-only]] score against the built-in registry
ancestors <paths...> --roots A [--built-ins]  ancestor chain + linearization completeness
constants <paths...> --nesting A::B NAME      lexical constant resolution
stats     <paths...>                          counts and per-phase timings
```

Paths must start with `.` or `/` — the arg parser uses that to tell paths from names.

`--oracle` scores against `herb::action_view_helpers`, the registry generated from
`config/action_view_helpers/` into the `herb` crate — the same source
`lib/herb/action_view/helper_registry.rb` is rendered from. Nothing is read at runtime.
`--gem` and `--public-only` filter it; `--public-only` is almost always what you want,
since the registry also records internal config accessors no template calls.

Examples, all against corpora already vendored in this repo. Resolve the gem path rather
than hardcoding a Ruby ABI version — `vendor/bundle/ruby/<version>/` moves whenever the
bundle is reinstalled under a different Ruby:

```bash
ACTIONVIEW=$(ls -d ../vendor/bundle/ruby/*/gems/actionview-*/lib | head -1)
TURBO=$(ls -d ../vendor/bundle/ruby/*/gems/turbo-rails-* | head -1)

./bin/herb-analysis smoke
./bin/herb-analysis ancestors $ACTIONVIEW --roots ActionView::Base
./bin/herb-analysis helpers $ACTIONVIEW --roots ActionView::Base --oracle --gem actionview --public-only
./bin/herb-analysis helpers $TURBO --roots Turbo::FramesHelper,Turbo::StreamsHelper \
  --oracle --gem turbo-rails --public-only
./bin/herb-analysis stats ../lib
```

Experiments against a real Rails app need one on disk; there is no usable fixture app in
this repo (`stimulus-lint/test/fixtures/test-rails-app/` has views but zero `.rb` files).

## Note on the dependency arrow

`herb-analysis` depends on `herb`; the root `herb` package must **never** depend on
`herb-analysis`. CI runs `cargo package` on the root package, and a path dependency
without a version breaks packaging.

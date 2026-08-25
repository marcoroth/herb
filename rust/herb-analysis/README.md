# herb-analysis

## Requirements

- Rust **1.89.0+** (rubydex declares `rust-version = "1.89.0"`)

## Build and run

```bash
cd rust && cargo build -p herb-analysis
./bin/herb-analysis --help
```

```
Usage: herb-analysis <command> [path] [options]

Commands:
  helpers          List everything a template can call, grouped by origin
  audit            Cross-check Herb's Action View helper registry against real sources
  ancestors        Show a module's ancestor chain and whether it is complete
  constants        List constants, or resolve one against a lexical nesting
  stats            Show index counts and per-phase timings
```

Paths default to the current directory and must start with `.` or `/`, which is how the
arg parser tells them from names. Without `--roots`, every indexed `*Helper` module is
used, so `herb-analysis helpers .` lists everything callable in the app you are standing in.

`audit` cross-checks `herb::action_view_helpers`, the registry generated from
`config/action_view_helpers/` into the `herb` crate, against what rubydex finds in real gem
sources. Disagreements are actionable in both directions: a registry entry nothing defines
usually means a wrong `source:` field, and a helper the registry has never heard of is a
candidate to add. It already found two wrong `source:` values (`button` and `submit` are
`FormBuilder` methods, not `FormHelper` ones).

`--gem` narrows the registry to one gem. Internal entries are excluded by default, since
the registry also records config accessors no template calls; `--include-internal` opts
back in.

```bash
ACTIONVIEW=$(ls -d ../vendor/bundle/ruby/*/gems/actionview-*/lib | head -1)
TURBO=$(ls -d ../vendor/bundle/ruby/*/gems/turbo-rails-* | head -1)

./bin/herb-analysis ancestors $ACTIONVIEW --roots ActionView::Base
./bin/herb-analysis audit $ACTIONVIEW --roots ActionView::Base --gem actionview
./bin/herb-analysis audit $TURBO --roots Turbo::FramesHelper,Turbo::StreamsHelper \
  --gem turbo-rails
./bin/herb-analysis stats ../lib
```

## What a template can call

`helpers` answers "what can a template here call". Run it from a Rails app, or pass a path.
In an app (one with a `Gemfile.lock`) it resolves the app's gems and route helpers and
groups the result by origin; pointed anywhere else it lists what those sources define.
Origins can be requested individually:

```bash
herb-analysis helpers                    # everything, grouped by origin
herb-analysis helpers --only app         # helpers defined in app/helpers
herb-analysis helpers --only gem         # helpers from gems in the Gemfile.lock
herb-analysis helpers --only rails       # Action View built-ins
herb-analysis helpers --only route       # route helpers from config/routes.rb
herb-analysis helpers --only app,gem     # any combination
herb-analysis helpers ../some/gem        # any directory, flat list
```

Narrower requests do less work. `--only route` reads `config/routes.rb` and indexes
nothing, and `--only app` skips gem sources entirely.

Names a controller exposes with `helper_method :name` are included too. They never appear
in a view's ancestor chain, so they are found by reading the declarations directly, and are
reported with the controller they came from. Dynamic forms such as `helper_method(type)`
carry no symbol and are skipped.

Route helpers are approximate. They are generated at boot from the routes DSL and have no
definition to find, so they are reconstructed from `root`, `resources`, `resource`, `as:`
and literal path segments. Nesting, `scope`, and `only:`/`except:` are not modelled.

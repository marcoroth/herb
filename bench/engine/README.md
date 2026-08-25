# bench/engine

Compile-time benchmark of `Herb::Engine` vs `Erubi::Engine` over the
[marcoroth/herb-corpus][herb-corpus] corpus.

Both engines take ERB source and return compiled Ruby source; this bench
measures that step only. Rendering, ActionView, and Herb's `optimize:` mode
are out of scope — those are covered by `bench/action_view/`.

Three variants are timed:

- `Erubi::Engine`
- `Herb::Engine` with `parser_options: { track_locations: false }` (the
  engine's default)
- `Herb::Engine` with `parser_options: { track_locations: true }` — the
  same code path plus the extra cost of recording source locations on
  every parse node.

## Run

From the repo root:

```
ruby bench/engine/run.rb
```

Optional:

```
BENCH_LIMIT=500 ruby bench/engine/run.rb   # first N files, faster iteration
```

The first invocation clones the corpus into `bench/tmp/herb-corpus/`
(~57 MB, blobless, one-time). Subsequent runs reuse it.

## Output

- Total wall time and per-file average for each engine variant
- Compiled output size (bytes) for each engine
- Per-engine failure count. Failing files are dumped to
  `bench/tmp/engine-{erubi_only,herb_only,both_failed}.txt` for triage —
  a failure that's Herb-specific is a real signal.

## Fairness

- Each engine runs in its own Ruby subprocess so one-time require / JIT /
  GC-warmup cost from one engine cannot bias the next.
- Only files that both engines can compile without raising are included in
  the timed set, so neither engine gets credit for skipping work.
- Sources are loaded into memory before timing so file I/O doesn't skew
  the measurement.
- No warmup: cold-compile performance is what this bench cares about.

[herb-corpus]: https://github.com/marcoroth/herb-corpus

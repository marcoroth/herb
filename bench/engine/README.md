# bench/engine

Compile-time benchmark of `Herb::Engine` vs `Erubi::Engine` over the
[marcoroth/herb-corpus][herb-corpus] corpus.

Both engines take ERB source and return compiled Ruby source; this bench
measures that step only. Rendering, ActionView, and Herb's `optimize:` mode
are out of scope — those are covered by `bench/action_view/`.

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

- Total wall time and per-file average for each engine
- Compiled output size (bytes) for each engine
- Per-engine failure count. Failing files are dumped to
  `bench/tmp/failures-{erubi,herb}.txt` (path, exception class, first message
  line) for triage — a failure that's Herb-specific is a real signal.

## Fairness

- Both engines run in the same Ruby process with the same GC state (per file).
- The corpus is loaded into memory before timing starts so file I/O doesn't
  skew the measurement.
- No warmup: cold-compile performance is what this bench cares about. Note
  that whichever engine runs first pays any one-time lazy-load cost inside
  its own dependencies; if that starts to matter, run the two engines in
  separate processes.

[herb-corpus]: https://github.com/marcoroth/herb-corpus

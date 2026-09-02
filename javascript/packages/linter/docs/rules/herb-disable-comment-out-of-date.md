# herb-disable-comment-out-of-date

Detect file-scoped `<%# herb:disable rule N %>` entries whose declared count (N) does not match the actual number of offenses in the file.

## Description

The extended `herb:disable` syntax accepts a per-rule count or `all` suffix, turning the disable comment into a file-scoped ratchet:

```erb
<%# herb:disable html-tag-name-lowercase 3 %>
```

This rule fires whenever the count in such an entry disagrees with the number of offenses the linter actually finds:

- `N > E` — the count over-promises. Every actual offense is still reported; this rule additionally flags the drift so you can lower the count.
- `0 < N < E` — the count under-promises. The linter suppresses the first `N` offenses and lets the rest surface; this rule flags the drift so you can raise the count.
- `N > 0` and `E == 0` — the rule no longer offends. This rule flags the entry so you can drop it (or run `--update-disable-counts`).

`herb:disable rule all` entries opt out of drift tracking and never emit this rule.

## Rationale

The whole point of the counted disable is that the count ratchets down as you fix offenses and holds the line against new ones. A stale count silently defeats both directions of that guarantee.

## Autofix

The autofix rewrites `N` in the source to match the actual count. Use `--fix` to apply, or `--update-disable-counts` to bulk-refresh across the project without dragging in other autofixes.

## Examples

### Bad

```erb
<%# herb:disable html-tag-name-lowercase 3 %>

<DIV></DIV>
<DIV></DIV>
```

The comment expects three offenses but the file only produces two. Autofix rewrites the count to `2`.

### Good

```erb
<%# herb:disable html-tag-name-lowercase 2 %>

<DIV></DIV>
<DIV></DIV>
```

## References

- [`herb-disable-comment-unnecessary`](./herb-disable-comment-unnecessary.md)
- [`herb-disable-comment-malformed`](./herb-disable-comment-malformed.md)

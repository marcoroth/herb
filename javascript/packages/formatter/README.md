# `@herb-tools/formatter`

Base utilities to format HTML + ERB templates using Herb.

This package currently exposes a simple formatter class that parses the
input using a provided `HerbBackend` instance. It returns the original
source for now and serves as a starting point for further formatting
work.

## Command‑Line Interface

With the `herb-formatter` executable (installed globally or via `npx`),
you can format files directly or pipe from stdin.

### Format a file

```bash
# relative path
herb-formatter templates/index.html.erb

# absolute path
herb-formatter /full/path/to/template.html.erb
```

### Format from stdin

```bash
cat template.html.erb | herb-formatter
# or explicitly use "-" for stdin
herb-formatter - < template.html.erb
```

# Herb Minifier

**Package:** [`@herb-tools/minifier`](https://www.npmjs.com/package/@herb-tools/minifier)

---

HTML+ERB template minification.

The minifier removes the whitespace that does not survive rendering and the comments that carry no markup, without touching anything that would change what the template renders or what its Ruby does.

## Installation

:::code-group
```shell [npm]
npm add @herb-tools/minifier
```

```shell [pnpm]
pnpm add @herb-tools/minifier
```

```shell [yarn]
yarn add @herb-tools/minifier
```

```shell [bun]
bun add @herb-tools/minifier
```
:::

### Usage

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { Minifier } from "@herb-tools/minifier"

const minifier = new Minifier(Herb)
await minifier.initialize()

minifier.minifyString(`
  <div class="container">
    <h1>Hello <b>World</b></h1>
  </div>
`)
// => '<div class="container"><h1>Hello <b>World</b></h1></div>'
```

Note the space before `<b>`. It is kept because `<b>` is an inline element, so that space is rendered.

To minify a tree you have already parsed, use `MinifyPrinter`:

```typescript
import { Herb } from "@herb-tools/node-wasm"
import { MinifyPrinter } from "@herb-tools/minifier"

const result = Herb.parse(source, { track_whitespace: true })

MinifyPrinter.print(result.value)
```

Parse with `track_whitespace: true`. Without it the whitespace inside an open tag is not represented by nodes, so the minifier cannot remove it.

### What is removed

* Whitespace that collapses away when the template renders, including whitespace at the edges of a block element and runs of whitespace between elements
* Whitespace between the attributes of an open tag, down to the single space that separates them
* HTML comments and ERB comments
* The whitespace inside a single-line ERB tag, so `<%=  user.name  %>` becomes `<%=user.name%>`

### What is kept

* The content of whitespace preserving elements, which are `pre`, `textarea`, `script`, `style`, `iframe`, `listing`, `noembed`, `noframes`, `plaintext` and `xmp`
* Whitespace that separates rendered text from an inline element, since removing it would join two words
* Downlevel-revealed conditional comments, which the browsers they target read as markup
* Herb directives, which reach the minifier as ERB comments when the template is parsed without the `herb_directives` option
* The content of a multi-line ERB tag, where a newline can terminate a heredoc, a line comment or a `=begin` block
* A newline after an ERB tag whose Ruby ends in a line comment, which would otherwise comment out the tag that follows it

### CLI Usage

```shell
herb-minify app/views/layouts/application.html.erb
```

```
Usage:
  herb-minify [options] <input-file-or-pattern>
  herb-minify -i <input-file> -o <output-file>

Options:
  -i, --input <file>           Input file path
  -o, --output <file>          Output file path (defaults to stdout)
  -w, --write                  Overwrite each input file with its minified output
  --config-file <path>         Explicitly specify path to .herb.yml config file
  --stats                      Show how many bytes were saved
  --glob                       Treat input as a glob pattern
  --verbose                    Print a line for every file, not just failures
  -v, --version                Show the version
  -h, --help                   Show this help message
```

Minify every template the project configuration matches and report the total saving:

```shell
herb-minify --glob --stats
```

In `--glob` mode the `files.include` and `files.exclude` settings from [`.herb.yml`](/projects/config) decide which files are processed.

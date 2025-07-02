## Herb Minifier

##### Package: [`@herb-tools/minifier`](https://www.npmjs.com/package/@herb-tools/minifier)

---

Intelligent HTML+ERB minifier that reduces file size while preserving functionality and ERB logic. Removes unnecessary whitespace, collapses multiple spaces, and optimizes output without breaking templates.

### Installation

```bash
npm install @herb-tools/minifier
# or
yarn add @herb-tools/minifier
```

### Usage

#### Programmatic API

```javascript
import { Minifier } from '@herb-tools/minifier'
import { Herb } from '@herb-tools/node-wasm'

const minifier = new Minifier({
  collapseWhitespace: true,
  collapseMultipleSpaces: true,
  collapseMultipleNewlines: true,
  preserveLineBreaks: false,
  preserveTags: ['pre', 'code', 'script', 'style', 'textarea'],
  trimTextNodes: true
})

const input = `<div>
  Hello     World

  <%= @name %>
</div>`

const parseResult = Herb.parse(input)
const result = minifier.minify(parseResult)

console.log(result.output)
// <div> Hello World <%= @name %> </div>

console.log(`Reduced ${result.reduction} characters (${result.reductionPercentage}% reduction)`)
```

#### CLI Usage

```bash
# Basic usage
herb-minify input.html.erb > output.html.erb

# With options
herb-minify -i input.html.erb -o output.html.erb --stats

# Preserve line breaks
herb-minify input.html.erb --preserve-line-breaks

# Custom preserve tags
herb-minify input.html.erb --preserve-tags pre,code,custom

# Show help
herb-minify --help
```

### Options

- `collapseWhitespace` (default: `true`) - Collapse whitespace sequences to single space
- `collapseMultipleSpaces` (default: `true`) - Replace multiple spaces with single space
- `collapseMultipleNewlines` (default: `true`) - Replace multiple newlines with single newline
- `preserveLineBreaks` (default: `false`) - Keep line breaks (collapses to single newline)
- `preserveTags` (default: `['pre', 'code', 'script', 'style', 'textarea']`) - Tags where whitespace should be preserved
- `trimTextNodes` (default: `true`) - Remove text nodes that contain only whitespace

### Features

- Collapses multiple spaces and newlines
- Preserves whitespace in pre-formatted tags
- Handles HTML+ERB templates correctly
- Provides detailed minification statistics
- Safe minification that doesn't break functionality

### API

#### `new Minifier(options?: MinifierOptions)`

Creates a new minifier instance with the specified options.

#### `minifier.minify(input: string | ParseResult | Node): MinifyResult`

Minifies the input and returns a result object containing:

- `output`: The minified string
- `originalSize`: Original size in bytes
- `minifiedSize`: Minified size in bytes
- `reduction`: Size reduction in bytes
- `reductionPercentage`: Percentage of size reduction

### License

MIT

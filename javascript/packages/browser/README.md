# @herb-tools/browser

[![npm version](https://badge.fury.io/js/%40herb-tools%2Fbrowser.svg)](https://badge.fury.io/js/%40herb-tools%2Fbrowser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

WebAssembly-based HTML-aware ERB parser optimized for modern browsers and client-side applications.

## Overview

`@herb-tools/browser` brings powerful ERB parsing capabilities directly to web browsers through an optimized WebAssembly implementation. This enables client-side template analysis, real-time syntax highlighting, and interactive ERB development tools without requiring a server.

## Why Use This Package?

### Client-Side ERB Processing
- **No server required**: Parse ERB templates entirely in the browser
- **Real-time analysis**: Instant feedback for template editing and validation
- **Offline capable**: Works without internet connectivity once loaded
- **Privacy-focused**: Template content never leaves the user's device

### Browser-Optimized
- **Small bundle size**: Optimized WebAssembly binary (~150KB gzipped)
- **Fast loading**: Async initialization with progressive enhancement
- **Memory efficient**: Minimal memory footprint for browser environments
- **Modern browser support**: Works in all browsers supporting WebAssembly

### Use Cases
- **Online ERB editors**: CodePen, JSFiddle, or custom ERB playgrounds
- **Educational tools**: Interactive ERB learning platforms
- **Documentation sites**: Live ERB examples with syntax highlighting
- **Development tools**: Browser-based ERB linters and formatters
- **Static site generators**: Client-side template processing
- **Browser extensions**: IDE-like features for ERB in web browsers

## Installation

```bash
npm install @herb-tools/browser
```

### CDN Usage

```html
<!-- Via unpkg -->
<script type="module">
  import { parse, lex } from 'https://unpkg.com/@herb-tools/browser@latest/dist/herb-browser.esm.js';
</script>

<!-- Via jsDelivr -->
<script type="module">
  import { parse, lex } from 'https://cdn.jsdelivr.net/npm/@herb-tools/browser@latest/dist/herb-browser.esm.js';
</script>
```

### Browser Requirements

- **WebAssembly support**: All modern browsers (Chrome 57+, Firefox 52+, Safari 11+, Edge 16+)
- **ES modules**: For optimal loading (fallback available)
- **Memory**: ~5MB for WebAssembly module and heap

## Usage

### Basic Parsing

```javascript
import { parse, lex } from '@herb-tools/browser';

// Parse ERB template
const template = '<div><%= user.name %></div>';
const parseResult = parse(template);

console.log('Document:', parseResult.document);
console.log('Errors:', parseResult.errors);
console.log('Warnings:', parseResult.warnings);

// Tokenize ERB template
const tokens = lex(template);
tokens.forEach(token => {
  console.log(`${token.type}: "${token.value}"`);
});
```

### Async Initialization

```javascript
import { initialize, parse } from '@herb-tools/browser';

async function main() {
  // Initialize WebAssembly module
  await initialize();
  
  // Parsing is now faster
  const result = parse('<%= "Hello Browser!" %>');
  console.log(result);
}

main();
```

### Interactive ERB Editor

```html
<!DOCTYPE html>
<html>
<head>
  <title>ERB Playground</title>
  <style>
    .editor { width: 100%; height: 200px; font-family: monospace; }
    .output { background: #f5f5f5; padding: 10px; white-space: pre-wrap; }
    .error { color: red; }
    .success { color: green; }
  </style>
</head>
<body>
  <h1>ERB Playground</h1>
  
  <textarea id="editor" class="editor" placeholder="Enter ERB template here...">
<div class="user-profile">
  <% if user.admin? %>
    <span class="badge">Admin</span>
  <% end %>
  <h2><%= user.name %></h2>
  <p><%= user.bio || "No bio available" %></p>
</div>
  </textarea>
  
  <div id="output" class="output"></div>

  <script type="module">
    import { parse, lex } from 'https://unpkg.com/@herb-tools/browser@latest/dist/herb-browser.esm.js';

    const editor = document.getElementById('editor');
    const output = document.getElementById('output');

    function analyzeTemplate() {
      const template = editor.value;
      
      try {
        const parseResult = parse(template);
        const tokens = lex(template);
        
        let result = `✓ Parsing successful!\n\n`;
        result += `AST Nodes: ${parseResult.document.children.length}\n`;
        result += `Tokens: ${tokens.length}\n`;
        
        if (parseResult.errors.length > 0) {
          result += `\nErrors:\n`;
          parseResult.errors.forEach(error => {
            result += `  • ${error.message} (Line ${error.location.start.line})\n`;
          });
        }
        
        if (parseResult.warnings.length > 0) {
          result += `\nWarnings:\n`;
          parseResult.warnings.forEach(warning => {
            result += `  • ${warning.message}\n`;
          });
        }
        
        output.textContent = result;
        output.className = 'output success';
      } catch (error) {
        output.textContent = `✗ Error: ${error.message}`;
        output.className = 'output error';
      }
    }

    // Real-time analysis
    editor.addEventListener('input', analyzeTemplate);
    
    // Initial analysis
    analyzeTemplate();
  </script>
</body>
</html>
```

### Syntax Highlighter

```javascript
import { lex } from '@herb-tools/browser';

function highlightERB(template) {
  const tokens = lex(template);
  let highlighted = '';
  
  tokens.forEach(token => {
    const value = escapeHtml(token.value);
    
    switch (token.type) {
      case 'TOKEN_ERB_START':
      case 'TOKEN_ERB_OUTPUT_START':
      case 'TOKEN_ERB_END':
        highlighted += `<span class="erb-delimiter">${value}</span>`;
        break;
      case 'TOKEN_ERB_CONTENT':
        highlighted += `<span class="erb-code">${value}</span>`;
        break;
      case 'TOKEN_HTML_TAG_OPEN':
      case 'TOKEN_HTML_TAG_CLOSE':
        highlighted += `<span class="html-tag">${value}</span>`;
        break;
      case 'TOKEN_HTML_ATTRIBUTE_NAME':
        highlighted += `<span class="html-attr">${value}</span>`;
        break;
      case 'TOKEN_HTML_TEXT':
        highlighted += `<span class="html-text">${value}</span>`;
        break;
      default:
        highlighted += value;
    }
  });
  
  return highlighted;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Usage
const template = '<div><%= user.name %></div>';
const highlighted = highlightERB(template);
document.getElementById('code').innerHTML = highlighted;
```

### Vue.js Integration

```vue
<template>
  <div class="erb-editor">
    <textarea 
      v-model="template" 
      @input="analyzeTemplate"
      class="editor"
    />
    <div class="analysis">
      <div v-if="parseResult">
        <h3>Analysis Results</h3>
        <p>Nodes: {{ parseResult.document.children.length }}</p>
        <p>Errors: {{ parseResult.errors.length }}</p>
        <ul v-if="parseResult.errors.length">
          <li v-for="error in parseResult.errors" :key="error.message">
            {{ error.message }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { parse } from '@herb-tools/browser';

export default {
  data() {
    return {
      template: '<%= "Hello Vue!" %>',
      parseResult: null
    };
  },
  methods: {
    analyzeTemplate() {
      try {
        this.parseResult = parse(this.template);
      } catch (error) {
        console.error('Parse error:', error);
      }
    }
  },
  mounted() {
    this.analyzeTemplate();
  }
};
</script>
```

### React Integration

```jsx
import React, { useState, useEffect } from 'react';
import { parse } from '@herb-tools/browser';

function ERBAnalyzer() {
  const [template, setTemplate] = useState('<%= "Hello React!" %>');
  const [parseResult, setParseResult] = useState(null);

  useEffect(() => {
    try {
      const result = parse(template);
      setParseResult(result);
    } catch (error) {
      console.error('Parse error:', error);
    }
  }, [template]);

  return (
    <div className="erb-analyzer">
      <textarea
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        className="editor"
        rows={10}
        cols={50}
      />
      
      {parseResult && (
        <div className="results">
          <h3>Analysis Results</h3>
          <p>AST Nodes: {parseResult.document.children.length}</p>
          <p>Errors: {parseResult.errors.length}</p>
          
          {parseResult.errors.length > 0 && (
            <ul>
              {parseResult.errors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default ERBAnalyzer;
```

## API Reference

### Core Functions

#### `parse(source: string): ParseResult`
Parses ERB template source into an Abstract Syntax Tree.

```typescript
interface ParseResult {
  document: DocumentNode;
  errors: HerbError[];
  warnings: HerbWarning[];
}
```

#### `lex(source: string): Token[]`
Tokenizes ERB template source into an array of tokens.

```typescript
interface Token {
  type: string;
  value: string;
  location: Location;
}
```

#### `extractRuby(source: string): string`
Extracts pure Ruby code from ERB template.

#### `extractHTML(source: string): string`
Extracts HTML structure from ERB template.

#### `initialize(): Promise<void>`
Pre-initializes the WebAssembly module for faster subsequent parsing.

### TypeScript Support

Full TypeScript definitions are included, with all types re-exported from `@herb-tools/core` for convenience.

## Performance Characteristics

Based on benchmarks in modern browsers:

- **Parsing speed**: ~25MB/s (varies by browser and device)
- **Memory usage**: ~4KB overhead per 100KB template
- **Initialization time**: ~10ms (WebAssembly loading and compilation)
- **Bundle size**: ~150KB gzipped (including WebAssembly)

Performance is optimized for interactive use cases with small to medium-sized templates.

## Browser Compatibility

### Fully Supported

- **Chrome**: 57+ (March 2017)
- **Firefox**: 52+ (March 2017)
- **Safari**: 11+ (September 2017)
- **Edge**: 16+ (October 2017)

### Mobile Support

- **iOS Safari**: 11+ (iOS 11, September 2017)
- **Chrome Mobile**: 57+ (March 2017)
- **Firefox Mobile**: 52+ (March 2017)
- **Samsung Internet**: 7.2+ (May 2018)

### Fallback Strategies

For older browsers without WebAssembly support:

```javascript
async function initializeHerb() {
  if (typeof WebAssembly !== 'undefined') {
    // Use @herb-tools/browser
    const { parse } = await import('@herb-tools/browser');
    return { parse };
  } else {
    // Fallback to server-side parsing
    return {
      parse: async (template) => {
        const response = await fetch('/api/parse-erb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template })
        });
        return response.json();
      }
    };
  }
}
```

## Building from Source

### Development Setup

```bash
# Clone the repository
git clone https://github.com/marcoroth/herb.git
cd herb/javascript/packages/browser

# Install dependencies
npm install

# Build WebAssembly and JavaScript
npm run build
```

### Build Process

1. **Compile C to WebAssembly**: Using Emscripten with browser optimizations
2. **Generate TypeScript types**: From WebAssembly interfaces
3. **Bundle JavaScript**: Rollup bundling optimized for browsers

### Build Scripts

- `npm run build`: Full build (WebAssembly + JavaScript)
- `npm run build:wasm`: Build WebAssembly module only
- `npm run build:javascript`: Build JavaScript wrapper only
- `npm run dev`: Development mode with file watching
- `npm run clean`: Remove all build artifacts

## WebAssembly Optimization

### Bundle Size Optimizations

- **Dead code elimination**: Unused C functions removed
- **Compression**: Brotli and gzip compression support
- **Lazy loading**: WebAssembly loaded on first use
- **Split loading**: Core types separate from WebAssembly

### Runtime Optimizations

- **Memory pooling**: Reuse memory allocations
- **Incremental GC**: Gradual memory cleanup
- **SIMD**: Vector instructions where supported
- **Multithreading**: Future support for SharedArrayBuffer

## Security Considerations

### Content Security Policy

To use this package with CSP, allow WebAssembly:

```html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' 'wasm-unsafe-eval';">
```

### Safe Template Processing

```javascript
import { parse } from '@herb-tools/browser';

function safeParseERB(template) {
  // Validate input size
  if (template.length > 1024 * 1024) {
    throw new Error('Template too large');
  }
  
  // Parse with error handling
  try {
    return parse(template);
  } catch (error) {
    console.warn('Parse failed:', error.message);
    return null;
  }
}
```

## Troubleshooting

### WebAssembly Loading Issues

```javascript
import { initialize } from '@herb-tools/browser';

try {
  await initialize();
  console.log('WebAssembly loaded successfully');
} catch (error) {
  console.error('WebAssembly loading failed:', error);
  // Implement fallback strategy
}
```

### Memory Issues

```javascript
// Monitor memory usage
function checkMemory() {
  if (performance.memory) {
    const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
    console.log(`Memory: ${Math.round(usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(totalJSHeapSize / 1024 / 1024)}MB`);
  }
}
```

### Performance Optimization

```javascript
// Pre-initialize for better performance
let herbInitialized = false;

async function ensureHerbReady() {
  if (!herbInitialized) {
    await initialize();
    herbInitialized = true;
  }
}

// Call once on page load
ensureHerbReady();
```

## Contributing

See the main [Herb contributing guide](../../../CONTRIBUTING.md) for development setup and contribution guidelines.

For browser-specific development:
1. Install Emscripten SDK for WebAssembly compilation
2. Make changes to C code in `../../../src/`
3. Run `npm run build:wasm` to recompile WebAssembly
4. Test in multiple browsers with `npm test`

## License

MIT License - see [LICENSE](../../../LICENSE.txt) for details.
# @herb-tools/core

[![npm version](https://badge.fury.io/js/%40herb-tools%2Fcore.svg)](https://badge.fury.io/js/%40herb-tools%2Fcore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Core TypeScript interfaces, AST node definitions, and utilities for the Herb HTML+ERB parser ecosystem.

## Overview

`@herb-tools/core` provides the foundational TypeScript types and interfaces used across all Herb packages. It contains no parsing functionality itself but defines the common API surface that all Herb implementations adhere to.

## Purpose

This package exists to:

- **Provide consistent types** across all Herb JavaScript/TypeScript packages
- **Enable interoperability** between different Herb backends (native, WebAssembly, etc.)
- **Support tooling development** with comprehensive TypeScript definitions
- **Maintain API compatibility** as a stable interface layer

## What's Included

### Core Interfaces

- **`HerbBackend`**: Interface that all parsing backends must implement
- **`ParseResult`**: Container for parsed AST with errors and warnings
- **`LexResult`**: Container for tokenization results
- **`TokenList`**: Collection of tokens with utility methods

### AST Node Types

Complete TypeScript definitions for all AST node types:

**Document Structure:**
- `DocumentNode`
- `LiteralNode`
- `WhitespaceNode`

**HTML Elements:**
- `HTMLElementNode`
- `HTMLOpenTagNode`
- `HTMLCloseTagNode`
- `HTMLSelfCloseTagNode`
- `HTMLAttributeNode`
- `HTMLTextNode`
- `HTMLCommentNode`
- `HTMLDoctypeNode`

**ERB Content:**
- `ERBContentNode`
- `ERBIfNode`
- `ERBElseNode`
- `ERBUnlessNode`
- `ERBCaseNode`
- `ERBWhenNode`
- `ERBWhileNode`
- `ERBUntilNode`
- `ERBForNode`
- `ERBBlockNode`
- `ERBBeginNode`
- `ERBRescueNode`
- `ERBEnsureNode`
- `ERBYieldNode`

### Utility Types

- **`Position`**: Line/column position information
- **`Range`**: Start/end position ranges
- **`Location`**: Complete source location data
- **`Token`**: Individual lexer tokens
- **`HerbError`**: Parsing error information
- **`HerbWarning`**: Parsing warning information
- **`Visitor`**: AST traversal interface

## Installation

```bash
npm install @herb-tools/core
```

## Usage

### Import Types

```typescript
import {
  HerbBackend,
  ParseResult,
  LexResult,
  DocumentNode,
  HTMLElementNode,
  ERBContentNode,
  Position,
  Range,
  Token
} from '@herb-tools/core';
```

### Implement a Backend

```typescript
import { HerbBackend, ParseResult, LexResult } from '@herb-tools/core';

class MyHerbBackend implements HerbBackend {
  parse(source: string): ParseResult {
    // Implementation here
  }

  lex(source: string): LexResult {
    // Implementation here
  }
}
```

### Type-Safe AST Processing

```typescript
import { DocumentNode, HTMLElementNode, ERBContentNode } from '@herb-tools/core';

function analyzeAST(document: DocumentNode) {
  document.children.forEach(child => {
    if (child.type === 'HTMLElementNode') {
      const element = child as HTMLElementNode;
      console.log(`HTML tag: ${element.tagName}`);
    } else if (child.type === 'ERBContentNode') {
      const erb = child as ERBContentNode;
      console.log(`ERB content: ${erb.content}`);
    }
  });
}
```

### Position Information

```typescript
import { Position, Range, Location } from '@herb-tools/core';

function reportError(location: Location, message: string) {
  const start = location.start;
  console.error(`Error at line ${start.line}, column ${start.column}: ${message}`);
}
```

## Relationship to Other Packages

This package is used by:

- **[@herb-tools/node](../node)**: Native Node.js bindings with maximum performance
- **[@herb-tools/node-wasm](../node-wasm)**: WebAssembly-based Node.js implementation  
- **[@herb-tools/browser](../browser)**: Browser-compatible WebAssembly implementation
- **[@herb-tools/language-server](../language-server)**: Language Server Protocol implementation

All these packages implement the interfaces defined in `@herb-tools/core`, ensuring consistent APIs.

## Development

### Building

```bash
npm run build
```

This compiles TypeScript to JavaScript and generates type definitions.

### Testing

```bash
npm test
```

Runs the test suite to verify type definitions and utility functions.

### Development Mode

```bash
npm run dev
```

Watches for changes and rebuilds automatically.

## API Stability

This package follows semantic versioning. The TypeScript interfaces are considered stable APIs:

- **Major version**: Breaking changes to public interfaces
- **Minor version**: New features, additional optional properties
- **Patch version**: Bug fixes, documentation improvements

## Contributing

See the main [Herb contributing guide](../../../CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](../../../LICENSE.txt) for details.

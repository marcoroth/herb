---
outline: deep
---

# Installing a binding

Herb is a C library with bindings for Ruby, JavaScript, Java and Rust. Every binding wraps the same parser, so a template parses to the same tree whichever one you use.

## Install

::: code-group
```shell [Ruby]
bundle add herb
```

```shell [JavaScript]
npm add @herb-tools/node
```

```shell [Java]
git clone https://github.com/marcoroth/herb
cd herb/java
make templates
make jni
make java
```

```shell [Rust]
cargo add herb
```
:::

The Ruby gem and the npm packages ship precompiled. Java builds from source and produces a native library, `libherb_jni.dylib` on macOS and `libherb_jni.so` on Linux.

## Load

::: code-group
```ruby [Ruby]
require "herb"

Herb.parse("<h1><%= title %></h1>")
```

```js [JavaScript]
import { Herb } from "@herb-tools/node"

await Herb.load()

Herb.parse("<h1><%= title %></h1>")
```

```java [Java]
import org.herb.Herb;
import org.herb.ParseResult;

ParseResult result = Herb.parse("<h1><%= title %></h1>");
```

```rust [Rust]
use herb::parse;

let result = parse("<h1><%= title %></h1>").unwrap();
```
:::

JavaScript is the one binding that has to be loaded before use. `Herb.load()` resolves once the native extension or the WebAssembly build is ready, and every call after that is synchronous.

## Which package

| Language | Package | Notes |
| --- | --- | --- |
| Ruby | [`herb`](https://rubygems.org/gems/herb) | Precompiled native extension |
| JavaScript, Node.js | [`@herb-tools/node`](https://www.npmjs.com/package/@herb-tools/node) | Native extension, reads files |
| JavaScript, browser | [`@herb-tools/browser`](https://www.npmjs.com/package/@herb-tools/browser) | WebAssembly, no file access |
| Java | built from source | JNI, needs the native library on `java.library.path` |
| Rust | [`herb`](https://crates.io/crates/herb) | FFI to the C library |

The browser and Node packages expose the same API, so code that does not touch the filesystem moves between them unchanged. [WebAssembly](/projects/webassembly) covers the browser build, and the per-language pages cover the rest of each setup, including [unreleased commits from npm](/bindings/javascript/#using-unreleased-commits) and the Java classpath.

## Next

[Parsing](/bindings/parsing) is where most work starts. [Lexing](/bindings/lexing) gives you tokens instead of a tree, [Extracting Ruby and HTML](/bindings/extracting) pulls one language out of a template, and [Working with the tree](/bindings/tree) walks what the parser returned.

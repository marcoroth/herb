---
outline: deep
---

# Herb Java Bindings

Herb provides official Java bindings through JNI (Java Native Interface) to the C library, allowing you to parse HTML+ERB in Java projects with native performance.

> [!TIP] More Language Bindings
> Herb also has bindings for:
> - [Ruby](/bindings/ruby/)
> - [JavaScript/Node.js](/bindings/javascript/)
> - [Rust](/bindings/rust/)

## Installation

The Java bindings are built from source. Check that Java is installed, then build them:

:::code-group
```shell
java -version

git clone https://github.com/marcoroth/herb
cd herb/java
make templates
make jni
make java
```
:::

This creates the native library, which is `libherb_jni.dylib` on macOS and `libherb_jni.so` on Linux. Add the compiled classes to your classpath and make sure the native library is on your `java.library.path`.

## Getting Started

:::code-group
```java
import org.herb.Herb;
import org.herb.ParseResult;

public class Example {
  public static void main(String[] args) {
    String source = "<h1><%= user.name %></h1>";

    ParseResult result = Herb.parse(source);
    System.out.println(result.value.inspect());
  }
}
```
:::

## The API

The API pages document each call once, with a Java tab alongside the other bindings.

| Page | Java methods |
| --- | --- |
| [Parsing](/bindings/parsing) | `Herb.parse(String)`, `Herb.parse(String, ParserOptions)` |
| [Lexing](/bindings/lexing) | `Herb.lex(String)` |
| [Extracting Ruby and HTML](/bindings/extracting) | `Herb.extractRuby`, `Herb.extractHTML` |
| [Working with the tree](/bindings/tree) | `Visitor<T>`, `node.accept(visitor)` |
| [Versions](/bindings/versions) | `Herb.version()`, `Herb.herbVersion()`, `Herb.prismVersion()` |

Two things the other bindings have are missing here. Reading a file is up to you, so pass the contents to `Herb.parse`, and there is no `locate`, so walk with a visitor and compare locations instead.

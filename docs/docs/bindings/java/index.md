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

### Prerequisites

Ensure you have Java installed:

:::code-group
```shell
java -version
```
:::

### Build from Source

Clone the repository and build the Java bindings:

:::code-group
```shell
git clone https://github.com/marcoroth/herb
cd herb/java
make templates
make jni
make java
```
:::

This creates the native library (`libherb_jni.dylib` on macOS, `.so` on Linux).

### Setting Up Your Project

Add the compiled classes to your classpath and ensure the native library is in your `java.library.path`.

## Getting Started

### Basic Example

Here's a simple example of parsing HTML+ERB:

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

### Lexing Example

You can also tokenize HTML+ERB source:

:::code-group
```java
import org.herb.Herb;
import org.herb.LexResult;
import org.herb.Token;

public class LexExample {
  public static void main(String[] args) {
    String source = "<h1><%= user.name %></h1>";

    LexResult result = Herb.lex(source);

    for (Token token : result.tokens) {
      System.out.println(token.inspect());
    }
  }
}
```
:::

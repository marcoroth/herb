---
outline: deep
---

# Versions

Every binding reports the version of itself, of the C library it wraps and of the Prism it parses Ruby with. A bug report is much easier to act on with this line in it.

::: code-group
```ruby [Ruby]
Herb.version
# => "herb gem v0.11.2, libprism v2.1.0+4691667, libherb v0.11.2 (Ruby C native extension)"
```

```js [JavaScript]
Herb.version
// => "@herb-tools/node@0.11.2, @herb-tools/core@0.11.2, libprism@2.1.0+4691667, libherb@0.11.2 (Node.js C++ native extension)"
```

```java [Java]
Herb.version();
// => "herb java v0.11.2, libprism v2.1.0+4691667, libherb v0.11.2 (Java JNI)"
```

```rust [Rust]
herb::version();
// => "herb rust v0.11.2, libprism v2.1.0+4691667, libherb v0.11.2 (Rust FFI)"
```
:::

Java and Rust also report the two versions on their own, which is the form to compare against in code.

::: code-group
```java [Java]
Herb.herbVersion();   // => "0.11.2"
Herb.prismVersion();  // => "2.1.0+4691667"
```

```rust [Rust]
herb::herb_version();   // => "0.11.2"
herb::prism_version();  // => "2.1.0+4691667"
```
:::

The `herb version` command prints the same information for the gem and the library it loaded.

```shell
bundle exec herb version
```

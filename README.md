<div align="center">
  <img alt="Herb HTML+ERB parser" height="256px" src="https://github.com/user-attachments/assets/d0714ee1-ca33-4aa4-aaa9-d632ba79d54a">
</div>

<h2 align="center">Herb</h2>

<h4 align="center">HTML+ERB (HTML + Embedded Ruby)</h4>

<div align="center">Powerful and seamless HTML-aware ERB parsing for editors, linters, and tooling.</div>

<p align="center">
  <a href="https://github.com/marcoroth/herb/blob/main/LICENSE.txt"><img alt="License" src="https://img.shields.io/github/license/marcoroth/herb"></a>
  <a href="https://github.com/marcoroth/herb/issues"><img alt="Issues" src="https://img.shields.io/github/issues/marcoroth/herb"></a>
</p>

---

## 🌿 What is Herb?

**Herb** is a fast, embeddable HTML+ERB parser and toolkit written in C, with bindings in Ruby and WebAssembly. It provides introspection for `.html.erb` files, ideal for building editor integrations, linters, formatters, and static analysis tools.

TODO: Should we include a section here for people coming from vscode? Like a 'how to use for vscode?

---

## Quick Start

```bash
git clone https://github.com/marcoroth/herb && cd herb

bundle install              # install Ruby dependencies          
bundle exec rake templates  # generate AST related files from the templates files/config.yml

make all                    # build the C library
bundle exec rake            # build the Ruby extension

yarn install                # Install all the JavaScript dependencies
yarn build                  # Build all the JavaScript packages 

./herb parse examples/simple_erb.html.erb
```
---

## Components

Herb consists 3 main components:

- **Core C Library** – Lexer, parser, and compiler logic
  - TODO: Explain what this is for
- **Ruby Bindings** – Build and test with `rake`, `bundler`, and `mtest`
  - TODO: Explain what this is for also...
- **WebAssembly Bindings** – JS/browser support via [`@herb-tools/browser`](https://github.com/marcoroth/herb/tree/main/javascript/packages/browser)
  - TODO: Explain what this is for also also...
- **Javascript VS Code Integration** - Extension for vscode integration
  - TODO: Dive deeper into what these guys do... I think consumes vscodes editor api to apply formatting/highlighting?
---

## Requirements

- [**Check**](https://libcheck.github.io/check/): For Unit testing
- [**Clang 19**](https://clang.llvm.org): The compiler
- [**Clang Format 19**](https://clang.llvm.org/docs/ClangFormat.html): Code formatting
- [**Clang Tidy 19**](https://clang.llvm.org/extra/clang-tidy/): Linting
- [**Prism v1.4.0**](https://github.com/ruby/prism/releases/tag/v1.4.0): Ruby parser
- [**Ruby**](https://www.ruby-lang.org/en/): For running bundler tasks
- [**Bundler**](https://bundler.io): For managing Ruby dependencies
- [**Emscripten**](https://emscripten.org): To compile to WebAssembly
- [**Doxygen**](https://www.doxygen.nl): To generate reference docs

---

## Setup & Build

### Install System Dependencies

#### Linux

```bash
xargs sudo apt-get install < Aptfile
# or manually:
sudo apt-get install check clang-19 clang-tidy-19 clang-format-19 emscripten doxygen
```

#### macOS

```bash
# using Homebrew
brew bundle
# or manually:
brew install check llvm@19 emscripten doxygen
```

### Clone the Repository

```bash
git clone https://github.com/marcoroth/herb && cd herb/
```

### Install Ruby and JS Dependencies

```bash
bundle install
bundle exec rake templates

yarn install
yarn build
```

### Compile Everything

```bash
make all                # Build the C library
bundle exec rake make   # Build the Ruby extension
```

---

## Usage

```bash
./herb [command] [options]

Herb 🌿 Powerful and seamless HTML-aware ERB parsing and tooling.

Commands:
  ./herb lex [file]      # Lex a file
  ./herb lex_json [file] # Lex and return result as JSON
  ./herb parse [file]    # Parse a file
  ./herb ruby [file]     # Extract Ruby from a file
  ./herb html [file]     # Extract HTML from a file
  ./herb prism [file]    # Parse extracted Ruby using Prism
```

Example:

```bash
./herb lex examples/simple_erb.html.erb
```

Output:
```
#<Herb::Token type="TOKEN_ERB_START" value="<%" ... >
#<Herb::Token type="TOKEN_ERB_CONTENT" value=" title " ... >
#<Herb::Token type="TOKEN_ERB_END" value="%>" ... >

Finished lexing in:

        12 µs
     0.012 ms
  0.000012  s
```

---

## Ruby Extension

We use `rake` and `rake-compiler` to compile the Ruby extension. Running rake will generate the needed templates, run make, build the needed artifacts, and run the Ruby tests.

```bash
rake
```
TODO: Should this be just `rake` or `bundle exec rake`

Start a console:

```bash
bundle console
```

```ruby
Herb.parse("<div><%= title %></div>")
# => #<Herb::ParseResult ... >
```

---

## Testing

### C Tests

```bash
make test
./run_herb_tests
```

### Ruby Tests

```bash
rake test
```

### JavaScript Tests

```bash
yarn test
```

---

## Integration Testing

The `bin/integration` script allows for quick local iteration. On every run it cleans the directory, builds the source from scratch and runs all checks, including the C-Tests, Ruby Tests, Linters, and examples in succession.

TODO: Alt -- Use `bin/integration` to clean, rebuild, and test everything in one command:

```bash
❯ bin/integration

[...]

Integration successful!
```

Successful output ends with:

```
Integration successful!
```

---

## Cleaning

Remove build artifacts:

```bash
make clean
```

---

## Documentation

Generate Doxygen docs:

```bash
doxygen Doxyfile
```

---

## License

This project is licensed under the MIT License – see [LICENSE.txt](LICENSE.txt) for details.
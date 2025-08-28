# Contributing Guidelines

Pull request, bug reports, and any other forms of contribution are welcomed and highly encouraged.

If you encounter any issues when following along with this file please dont hesitate to reach out and file an issue!

## Running Locally

### Requirements

- [**Check**](https://libcheck.github.io/check/): For unit testing.
- [**Clang 19**](https://clang.llvm.org): The compiler used to build this project.
- [**Clang Format 19**](https://clang.llvm.org/docs/ClangFormat.html): For formatting the project.
- [**Clang Tidy 19**](https://clang.llvm.org/extra/clang-tidy/): For linting the project.
- [**Prism Ruby Parser v1.4.0**](https://github.com/ruby/prism/releases/tag/v1.4.0): We use Prism for Parsing the Ruby Source Code in the HTML+ERB files.
- [**Ruby**](https://www.ruby-lang.org/en/): We need Ruby as a dependency for `bundler`.
- [**Bundler**](https://bundler.io): We are using `bundler` to build [`prism`](https://github.com/ruby/prism) from source so we can build `herb` against it.
- [**Emscripten**](https://emscripten.org): For the WebAssembly build of `libherb` so it can be used in the browser using the [`@herb-tools/browser`](https://github.com/marcoroth/herb/blob/main/javascript/packages/browser) package.
- [**Doxygen**](https://www.doxygen.nl): For building the C-Reference documentation pages.


##### For Linux

```bash
xargs sudo apt-get install < Aptfile
```
or:

```bash
sudo apt-get install check clang-19 clang-tidy-19 clang-format-19 emscripten doxygen
```

##### For macOS (using Homebrew)

```bash
brew bundle
```
or:

```bash
brew install check llvm@19 emscripten doxygen
```

### Building

#### Clone the Repo

Clone the Git Repository:

```
git clone https://github.com/marcoroth/herb && cd herb/
```

#### Build Herb

We can now compile all source files in `src/` and generate the `herb` executable.

```bash
make all
```

> [!NOTE]
For any consecutive builds you can just run `make`/`make all`.

### Run

The `herb` executable exposes a few commands for interacting with `.html.erb` files:

```
❯ ./herb
./herb [command] [options]

Herb 🌿 Powerful and seamless HTML-aware ERB parsing and tooling.

./herb lex [file]      -  Lex a file
./herb lex_json [file] -  Lex a file and return the result as json.
./herb parse [file]    -  Parse a file
./herb ruby [file]     -  Extract Ruby from a file
./herb html [file]     -  Extract HTML from a file
./herb prism [file]    -  Extract Ruby from a file and parse the Ruby source with Prism
```

Running the executable shows a pretty-printed output for the respective command and the time it took to execute:

```
❯ ./herb lex examples/simple_erb.html.erb

#<Herb::Token type="TOKEN_ERB_START" value="<%" range=[0, 2] start=(1:0) end=(1:2)>
#<Herb::Token type="TOKEN_ERB_CONTENT" value=" title " range=[2, 9] start=(1:2) end=(1:9)>
#<Herb::Token type="TOKEN_ERB_END" value="%>" range=[9, 11] start=(1:9) end=(1:11)>
#<Herb::Token type="TOKEN_NEWLINE" value="\n" range=[11, 12] start=(1:0) end=(2:1)>
#<Herb::Token type="TOKEN_EOF" value="" range=[12, 12] start=(2:1) end=(2:1)>

Finished lexing in:

        12 µs
     0.012 ms
  0.000012  s
```

### Building the Ruby extension

We use `rake` and `rake-compiler` to compile the Ruby extension. Running rake will generate the needed templates, run make, build the needed artifacts, and run the Ruby tests.

```bash
bundle exec rake
```

If `rake` was successful you can use `bundle console` to interact with `Herb`:

```bash
bundle console
```

```
irb(main):001> Herb.parse("<div></div>")

# => #<Herb::ParseResult:0x0000000 ... >
```

### Test

Builds the test suite from files in `test/` and creates the `run_herb_tests` executable to run the tests:

#### For the C Tests

```bash
make test && ./run_herb_tests
```

#### For the Ruby Tests

```bash
bundle exec rake test
```

### Clean

Removes the `herb`, `run_herb_tests`, `prism` installation, and all `.o` files.

```bash
make clean
```

### Local Integration Testing

The `bin/integration` script allows for quick local iteration. On every run it cleans the directory, builds the source from scratch and runs all checks, including the C-Tests, Ruby Tests, Linters, and examples in succession.

```bash
bin/integration
```

The integration was successful if you see:

```
❯ bin/integration

[...]

Integration successful!
```


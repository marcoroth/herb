# 🌿 Herb

Seamless and powerful HTML-aware ERB parsing.

## Contributing

This project builds the Herb program and its associated unit tests using a Makefile for automation. The Makefile provides several useful commands for compiling, running tests, and cleaning the project.

### Requirements

- [**Check**](https://libcheck.github.io/check/): For unit testing.
- [**Clang 19**](https://clang.llvm.org): The compiler used to build this project.
- [**Clang Format 19**](https://clang.llvm.org/docs/ClangFormat.html): For formatting the project.
- [**Clang Tidy 19**](https://clang.llvm.org/extra/clang-tidy/): For linting the project.
- [**Prism Ruby Parser v1.3.0**](https://github.com/ruby/prism/releases/tag/v1.3.0): We use Prism for Parsing the Ruby Source Code in the HTML+ERB files.
- [**Ruby**](https://www.ruby-lang.org/en/): We need Ruby as a dependency for `bundler`.
- [**Bundler**](https://bundler.io): We are using `bundler` to build [`prism`](https://github.com/ruby/prism) from source so we can build `herb` against it.

##### For Linux

```bash
xargs sudo apt-get install < Aptfile
```
or:

```bash
sudo apt-get install check clang-19 clang-tidy-19 clang-format-19
```

##### For macOS (using Homebrew)

```bash
brew bundle
```
or:

```bash
brew install check llvm@19
```

### Building

#### Clone the Repo

Clone the Git Repository:

```
git clone https://github.com/marcoroth/herb && cd herb/
```

#### Build Prism

Before we can compile Herb we need to compile Prism from source:

```bash
make prism
```

#### Build Herb

After compiling `prism` we can now compile all source files in `src/` and generate the `herb` executable.

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

Herb 🌿 Seamless and powerful HTML-aware ERB parsing.

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

#<Token type=TOKEN_ERB_START value='<%' range=[0, 2] start=1:1 end=1:3>
#<Token type=TOKEN_ERB_CONTENT value=' title ' range=[2, 9] start=1:3 end=1:10>
#<Token type=TOKEN_ERB_END value='%>' range=[9, 11] start=1:10 end=1:12>
#<Token type=TOKEN_NEWLINE value='\n' range=[11, 12] start=1:0 end=2:1>
#<Token type=TOKEN_EOF value='' range=[12, 12] start=2:1 end=2:1>

Finished lexing in:

        24 µs
     0.024 ms
  0.000024  s
```

### Test

Builds the test suite from files in `test/` and creates the `run_herb_tests` executable to run the tests:

#### For the C Tests

```bash
make test && ./run_herb_tests
```

#### For the Ruby Tests

```bash
rake test
```

### Clean

Removes the `herb`, `run_herb_tests`, and all `.o` files.

```bash
make clean
```

If you want to also clean prism you can run:

```bash
make prism_clean
```

### Local Integration Testing

The `bin/integration` script allows for quick local iteration. On every run it clean the directory, builds the source from scratch and runs all checks, including the C-Tests, Ruby Tests, Linters, and examples in succession.

```bash
bin/integration
```

The integration was successful if you see:

```
❯ bin/integration

[...]

Integration successful!
```

Optionally there is also the `bin/prism_integration` script to run a full E2E build integration.

The difference is that the `bin/prism_integration` script also cleans out prism before building prism and herb from scratch.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.txt) file for details.

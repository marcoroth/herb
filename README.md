# ERBX

Seamless and powerful HTML+ERB parsing.

## Contributing

This project builds the ERBX program and its associated unit tests using a Makefile for automation. The Makefile provides several useful commands for compiling, running tests, and cleaning the project.

### Building

#### Requirements

- [**Check**](https://libcheck.github.io/check/): For unit testing.
- [**Clang 19**](https://clang.llvm.org): The compiler used to build this project.
- [**Clang Format 19**](https://clang.llvm.org/docs/ClangFormat.html): For formatting the project.
- [**Clang Tidy 19**](https://clang.llvm.org/extra/clang-tidy/): For linting the project.
- [**Ruby**](https://www.ruby-lang.org/en/): We need Ruby as a dependency for `bundler`.
- [**Bundler**](https://bundler.io): We are using `bundler` to build [`prism`](https://github.com/ruby/prism) from source so we can build `erbx` against it.

**For Linux:**  

```bash
xargs sudo apt-get install < Aptfile
# or
sudo apt-get install check clang-19 clang-tidy-19 clang-format-19
```

**For macOS (using Homebrew):**

```bash
brew bundle
# or
brew install check llvm@19
```

### Commands

#### Build

Compiles all source files in `src/` and generates the `erbx` executable.

```bash
make
```

#### Test

Builds the test suite from files in `test/` and creates the `run_erbx_tests` executable to run the tests:

```bash
make test && ./run_erbx_tests
```

### Clean

Removes the `erbx`, `run_erbx_tests`, and all `.o` files.

```bash
make clean
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.txt) file for details.

# ERBx

Seamless Parsing for HTML, ERB, and more.

## Contributing

This project builds the ERBX program and its associated unit tests using a Makefile for automation. The Makefile provides several useful commands for compiling, running tests, and cleaning the project.

### Requirements

- **GCC**
- **Check**: The project uses the [Check](https://libcheck.github.io/check/) library for unit testing.
- **Clang Format**: The project uses [Clang Format](https://clang.llvm.org/docs/ClangFormat.html) for formatting.
- **Clang Tidy**: The project uses [Clang Format](https://clang.llvm.org/docs/ClangFormat.html) for formatting.

For Linux:
```bash
sudo apt-get install check clang-format-19 clang-tidy
```

For macOS (using Homebrew):
```bash
brew install check clang-format llvm
# or
brew bundle
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

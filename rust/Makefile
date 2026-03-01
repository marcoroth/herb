# Rust Makefile for Herb

BUILD_DIR = target
BIN_NAME = herb-rust
BIN_PATH = $(BUILD_DIR)/debug/$(BIN_NAME)
RELEASE_BIN_PATH = $(BUILD_DIR)/release/$(BIN_NAME)

.PHONY: all build release clean test cli help templates format vendor wasm

all: templates build

templates:
	cd .. && bundle exec rake templates

build: templates
	cargo +stable build --verbose --workspace
	@echo "Built workspace (debug)"

release: templates
	cargo build --release --workspace
	@echo "Built workspace (release)"

cli: build
	@echo "CLI ready! Use: ./bin/$(BIN_NAME) [command] [file]"
	@echo ""
	@./bin/$(BIN_NAME) || true

test: build
	NO_COLOR=1 cargo +stable test --verbose --workspace

format:
	cargo +nightly fmt --all
	@echo "Formatted Rust code"

format-check:
	cargo +nightly fmt --all --check
	@echo "Checked Rust code formatting"

lint:
	cargo +stable clippy --workspace --all-targets --all-features
	@echo "Linted Rust code"

clean:
	cargo clean
	@echo "Cleaned Rust build artifacts"

wasm: templates
	@echo "Building herb-linter for wasm32-unknown-emscripten..."
	@# Temporarily remove cdylib from herb crate-type to avoid emscripten linker errors
	sed 's/crate-type = \["cdylib", "rlib"\]/crate-type = ["rlib"]/' Cargo.toml > Cargo.toml.wasm
	mv Cargo.toml Cargo.toml.bak && mv Cargo.toml.wasm Cargo.toml
	cargo rustc --release --target wasm32-unknown-emscripten -p herb-linter --lib --crate-type staticlib || \
		(mv Cargo.toml.bak Cargo.toml && exit 1)
	mv Cargo.toml.bak Cargo.toml
	@echo "Built target/wasm32-unknown-emscripten/release/libherb_linter.a"

vendor:
	@echo "Vendoring C sources into vendor/libherb..."
	rm -rf vendor/
	mkdir -p vendor/libherb/
	mkdir -p vendor/prism/
	cp -r ../src vendor/libherb/
	@echo "Vendoring prism library..."
	PRISM_PATH=$$(bundle show prism) && \
	cp -r "$$PRISM_PATH/src" vendor/prism/ && \
	cp -r "$$PRISM_PATH/include" vendor/prism/
	@echo "Vendored C sources and prism successfully"

help:
	@echo "Herb Rust Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all        - Build everything (templates + Rust)"
	@echo "  templates  - Generate code from ERB templates"
	@echo "  build      - Build workspace (debug)"
	@echo "  release    - Build workspace (release)"
	@echo "  cli        - Show CLI usage"
	@echo "  test       - Run all workspace tests"
	@echo "  format     - Format Rust code with rustfmt"
	@echo "  wasm       - Build herb-linter staticlib for wasm32-unknown-emscripten"
	@echo "  vendor     - Vendor C sources into vendor/"
	@echo "  clean      - Remove build artifacts"
	@echo "  help       - Show this help"
	@echo ""
	@echo "Binaries:"
	@echo "  Debug:   $(BIN_PATH)"
	@echo "  Release: $(RELEASE_BIN_PATH)"

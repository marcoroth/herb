# Rust Makefile for Herb

BUILD_DIR = target
BIN_NAME = herb-rust
BIN_PATH = $(BUILD_DIR)/debug/$(BIN_NAME)
RELEASE_BIN_PATH = $(BUILD_DIR)/release/$(BIN_NAME)

.PHONY: all build release clean test cli help templates format

all: templates build

templates:
	cd .. && bundle exec rake templates

build: templates
	cargo +stable build --verbose --bin $(BIN_NAME)
	@echo "Built debug binary: $(BIN_PATH)"

release: templates
	cargo build --release --bin $(BIN_NAME)
	@echo "Built release binary: $(RELEASE_BIN_PATH)"

cli: build
	@echo "CLI ready! Use: ./bin/$(BIN_NAME) [command] [file]"
	@echo ""
	@./bin/$(BIN_NAME) || true

test: build
	NO_COLOR=1 cargo +stable test --verbose -- --test-threads=1

format:
	cargo +nightly fmt
	@echo "Formatted Rust code"

format-check:
	cargo +nightly fmt --check
	@echo "Checked Rust code formatting"

lint:
	cargo +stable clippy --all-targets --all-features
	@echo "Linted Rust code"

clean:
	cargo clean
	@echo "Cleaned Rust build artifacts"

help:
	@echo "Herb Rust Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all        - Build everything (templates + Rust)"
	@echo "  templates  - Generate code from ERB templates"
	@echo "  build      - Build debug binary"
	@echo "  release    - Build release binary"
	@echo "  cli        - Show CLI usage"
	@echo "  test       - Run Rust tests"
	@echo "  format     - Format Rust code with rustfmt"
	@echo "  clean      - Remove build artifacts"
	@echo "  help       - Show this help"
	@echo ""
	@echo "Binaries:"
	@echo "  Debug:   $(BIN_PATH)"
	@echo "  Release: $(RELEASE_BIN_PATH)"

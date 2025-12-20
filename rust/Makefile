# Rust Makefile for Herb

BUILD_DIR = target
BIN_NAME = herb-rust
BIN_PATH = $(BUILD_DIR)/debug/$(BIN_NAME)
RELEASE_BIN_PATH = $(BUILD_DIR)/release/$(BIN_NAME)

.PHONY: all build release clean test cli help setup templates prism format vendor

all: build

setup:
	cd .. && bundle install
	cd .. && bundle exec rake templates
	cd .. && bundle exec rake prism:vendor

templates:
	cd .. && bundle install && bundle exec rake templates

prism:
	cd .. && bundle install && bundle exec rake prism:vendor

build:
	cargo +stable build --verbose --bin $(BIN_NAME)
	@echo "Built debug binary: $(BIN_PATH)"

release:
	cargo build --release --bin $(BIN_NAME)
	@echo "Built release binary: $(RELEASE_BIN_PATH)"

cli: build
	@echo "CLI ready! Use: ./bin/$(BIN_NAME) [command] [file]"
	@echo ""
	@./bin/$(BIN_NAME) || true

test: build
	NO_COLOR=1 cargo +stable test --verbose

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

vendor: prism
	@echo "Vendoring C sources into vendor/libherb..."
	rm -rf vendor/
	mkdir -p vendor/libherb/
	mkdir -p vendor/prism/
	cp -r ../src vendor/libherb/
	@echo "Vendoring prism library..."
	cp -r ../vendor/prism/src vendor/prism/
	cp -r ../vendor/prism/include vendor/prism/
	@echo "Vendored C sources and prism successfully"

help:
	@echo "Herb Rust Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all        - Build Rust binary"
	@echo "  setup      - Install deps, generate templates, vendor prism"
	@echo "  templates  - Generate code from ERB templates"
	@echo "  prism      - Vendor prism library sources"
	@echo "  build      - Build debug binary"
	@echo "  release    - Build release binary"
	@echo "  cli        - Show CLI usage"
	@echo "  test       - Run Rust tests"
	@echo "  format     - Format Rust code with rustfmt"
	@echo "  vendor     - Vendor C sources into vendor/"
	@echo "  clean      - Remove build artifacts"
	@echo "  help       - Show this help"
	@echo ""
	@echo "Binaries:"
	@echo "  Debug:   $(BIN_PATH)"
	@echo "  Release: $(RELEASE_BIN_PATH)"

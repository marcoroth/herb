exec = herb
test_exec = run_herb_tests

sources = $(wildcard src/*.c) $(wildcard src/**/*.c)
headers = $(wildcard src/*.h) $(wildcard src/**/*.h)
objects = $(sources:.c=.o)

extension_sources = $(wildcard ext/**/*.c)
extension_headers = $(wildcard ext/**/*.h)
extension_objects = $(extension_sources:.o)

prism_objects = $(filter-out src/main.c, $(sources))

project_files = $(sources) $(headers)
extension_files = $(extension_sources) $(extension_headers)
nodejs_extension_files = $(wildcard node/**/*.cpp) $(wildcard node/**/*.h) $(wildcard node/**/*.hpp)
project_and_extension_files = $(project_files) $(extension_files) $(nodejs_extension_files)

test_sources = $(wildcard test/**/*.c)
test_objects = $(test_sources:.c=.o)
non_main_objects = $(filter-out src/main.o, $(objects))

soext ?= $(shell ruby -e 'puts RbConfig::CONFIG["DLEXT"]')
lib_name = $(build_dir)/lib$(exec).$(soext)
static_lib_name = $(build_dir)/lib$(exec).a
ruby_extension = ext/herb/$(lib_name)

build_dir = build
$(shell mkdir -p $(build_dir))

os := $(shell uname -s)

prism_path = $(shell bundle show prism)
prism_include = $(prism_path)/include
prism_build = $(prism_path)/build

prism_flags = -I$(prism_include)
prism_ldflags = $(prism_build)/libprism.a

# Enable strict warnings
warning_flags = -Wall -Wextra -Werror -pedantic

# Debug build (no optimizations, debug symbols)
debug_flags = -g -O0 -Wno-unused-parameter

# Production build (optimized)
production_flags = $(warning_flags) -O3 -march=native -flto

# Shared library flags (only for `.so`/`.dylib`/`.bundle`)
shared_library_flags = -fPIC

# Default build mode (change this as needed)
flags = $(warning_flags) $(debug_flags) $(prism_flags) -std=c99

# Separate test compilation flags
test_flags = $(debug_flags) $(prism_flags) -std=gnu99

# Shared library build (if needed)
shared_flags = $(production_flags) $(shared_library_flags) $(prism_flags)

# Emscripten-specific flags
emscripten_flags = -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME="libherb" -s EXPORTED_FUNCTIONS="['_herb_lex', '_herb_parse', '_herb_version']" -s EXPORTED_RUNTIME_METHODS='["cwrap"]' -s SINGLE_FILE=1 -s EXPORT_ES6=1

ifeq ($(os),Linux)
  test_cflags = $(test_flags) -I/usr/include/check
  test_ldflags = -L/usr/lib/x86_64-linux-gnu -lcheck -lm -lsubunit $(prism_ldflags)
  cc = clang-19
  clang_format = clang-format-19
  clang_tidy = clang-tidy-19
endif

ifeq ($(os),Darwin)
  brew_prefix := $(shell brew --prefix check)
  test_cflags = $(test_flags) -I$(brew_prefix)/include
  test_ldflags = -L$(brew_prefix)/lib -lcheck -lm $(prism_ldflags)
  llvm_path = $(shell brew --prefix llvm@19)
  cc = $(llvm_path)/bin/clang
  clang_format = $(llvm_path)/bin/clang-format
  clang_tidy = $(llvm_path)/bin/clang-tidy
endif

all: prism $(exec) $(lib_name) $(static_lib_name) test wasm

$(exec): $(objects)
	$(cc) $(objects) $(flags) $(ldflags) $(prism_ldflags) -o $(exec)

$(lib_name): $(objects)
	$(cc) -shared $(objects) $(shared_flags) $(ldflags) $(prism_ldflags) -o $(lib_name)
	# cp $(lib_name) $(ruby_extension)

$(static_lib_name): $(objects)
	ar rcs $(static_lib_name) $(objects)

%.o: %.c include/%.h
	$(cc) -c $(flags) $< -o $@

test/%.o: test/%.c
	$(cc) -c $(test_cflags) $(test_flags) $(prism_flags) $< -o $@

test: $(test_objects) $(non_main_objects)
	$(cc) $(test_objects) $(non_main_objects) $(test_cflags) $(test_ldflags) -o $(test_exec)

clean:
	rm -f $(exec) $(test_exec) $(lib_name) $(shared_lib_name) $(ruby_extension)
	rm -rf $(objects) $(test_objects) $(extension_objects) lib/herb/*.bundle tmp
	rm -rf $(prism_path)

bundle_install:
	bundle install

prism: bundle_install
	cd $(prism_path) && ruby templates/template.rb && make static && cd -

format:
	$(clang_format) -i $(project_and_extension_files)

lint:
	$(clang_format) --dry-run --Werror $(project_and_extension_files)

tidy:
	$(clang_tidy) $(project_files) -- $(flags)

# Create a WASM build that doesn't include prism
BROWSER_BUILD_DIR = ./javascript/packages/browser/build/

wasm:
	cd $(prism_path) && make wasm

	mkdir -p $(BROWSER_BUILD_DIR)
	mkdir -p $(BROWSER_BUILD_DIR)prism/

	emcc $(sources) $(emscripten_flags) $(prism_flags) \
	-s ERROR_ON_UNDEFINED_SYMBOLS=0 \
	-s EXPORTED_FUNCTIONS="['_herb_lex', '_herb_parse', '_herb_version', '_main', '_wasm_extract_ruby', '_wasm_extract_html', '_wasm_lex', '_wasm_parse']" \
	-s EXPORTED_RUNTIME_METHODS='["cwrap", "UTF8ToString", "stringToUTF8", "lengthBytesUTF8"]' \
	-s ENVIRONMENT='web' \
	-o $(BROWSER_BUILD_DIR)libherb.js

	cp $(prism_path)/javascript/src/* $(BROWSER_BUILD_DIR)prism/

	curl -o ./javascript/packages/browser/build/wasi-shim.js https://unpkg.com/@bjorn3/browser_wasi_shim@latest/dist/index.js
	cp ./node_modules/@bjorn3/browser_wasi_shim/dist/index.js ./javascript/packages/browser/build/wasi-shim.js

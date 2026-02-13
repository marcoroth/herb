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

ifeq ($(os),Linux)
  test_cflags = $(test_flags) -I/usr/include/check
  test_ldflags = -L/usr/lib/x86_64-linux-gnu -lcheck -lm -lsubunit $(prism_ldflags)
  cc = clang-21
  clang_format = clang-format-21
  clang_tidy = clang-tidy-21
endif

ifeq ($(os),Darwin)
  llvm_version := 21
  llvm_prefix ?= $(shell brew --prefix llvm@$(llvm_version))
  check_prefix ?= $(shell brew --prefix check)

  cc ?= $(llvm_prefix)/bin/clang
  clang_format ?= $(llvm_prefix)/bin/clang-format
  clang_tidy ?= $(llvm_prefix)/bin/clang-tidy

  test_cflags = $(test_flags) -I$(check_prefix)/include
  test_ldflags = -L$(check_prefix)/lib -lcheck -lm $(prism_ldflags)
endif

.PHONY: all
all: templates prism $(exec) $(lib_name) $(static_lib_name) test wasm clangd_config

$(exec): $(objects)
	$(cc) $(objects) $(flags) $(ldflags) $(prism_ldflags) -o $(exec)

$(lib_name): $(objects)
	$(cc) -shared $(objects) $(shared_flags) $(ldflags) $(prism_ldflags) -o $(lib_name)
	# cp $(lib_name) $(ruby_extension)

$(static_lib_name): $(objects)
	ar rcs $(static_lib_name) $(objects)

src/%.o: src/%.c templates
	$(cc) -c $(flags) -fPIC $< -o $@

test/%.o: test/%.c templates prism
	$(cc) -c $(test_cflags) $(test_flags) $(prism_flags) $< -o $@

.PHONY: test
test: $(test_objects) $(non_main_objects)
	$(cc) $(test_objects) $(non_main_objects) $(test_cflags) $(test_ldflags) -o $(test_exec)

.PHONY: clean
clean:
	rm -f $(exec) $(test_exec) $(lib_name) $(shared_lib_name) $(ruby_extension)
	rm -rf $(objects) $(test_objects) $(extension_objects) lib/herb/*.bundle tmp
	rm -rf $(prism_path)
	rake prism:clean

.PHONY: bundle_install
bundle_install:
	bundle install

.PHONY: templates
templates: bundle_install
	bundle exec rake templates

.PHONY: prism
prism: bundle_install
	cd $(prism_path) && ruby templates/template.rb && make static && cd -
	rake prism:vendor

.PHONY: format
format:
	$(clang_format) -i $(project_and_extension_files)

.PHONY: lint
lint:
	$(clang_format) --dry-run --Werror $(project_and_extension_files)

.PHONY: tidy
tidy:
	$(clang_tidy) $(project_files) -- $(flags)

.PHONY: clangd_config
clangd_config:
	@echo "$(flags) $(test_cflags)" | tr ' ' '\n' | sort -u > compile_flags.txt

.PHONY: wasm
wasm:
	cd wasm && make

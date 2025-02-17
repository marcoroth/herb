exec = erbx
test_exec = run_erbx_tests

sources = $(wildcard src/*.c) $(wildcard src/**/*.c)
headers = $(wildcard src/*.h) $(wildcard src/**/*.h)
objects = $(sources:.c=.o)

extension_sources = $(wildcard ext/**/*.c)
extension_headers = $(wildcard ext/**/*.h)

prism_objects = $(filter-out src/main.c, $(sources))

project_files = $(sources) $(headers)
extension_files = $(extension_sources) $(extension_headers)
project_and_extension_files = $(project_files) $(extension_files)

test_sources = $(wildcard test/**/*.c)
test_objects = $(test_sources:.c=.o)
non_main_objects = $(filter-out src/main.o, $(objects))

soext ?= $(shell ruby -e 'puts RbConfig::CONFIG["DLEXT"]')
lib_name = lib$(exec).$(soext)
ruby_extension = ext/erbx/$(lib_name)

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

all: $(exec) $(lib_name) test

$(exec): $(objects)
	$(cc) $(objects) $(flags) $(ldflags) $(prism_ldflags) -o $(exec)

$(lib_name): $(objects)
	$(cc) -shared $(objects) $(shared_flags) $(ldflags) $(prism_ldflags) -o $(lib_name)
	# cp $(lib_name) $(ruby_extension)

%.o: %.c include/%.h
	$(cc) -c $(flags) $< -o $@

test/%.o: test/%.c
	$(cc) -c $(test_cflags) $(test_flags) $(prism_flags) $< -o $@

test: $(test_objects) $(non_main_objects)
	$(cc) $(test_objects) $(non_main_objects) $(test_cflags) $(test_ldflags) -o $(test_exec)

clean:
	rm -f $(exec) $(test_exec) $(lib_name) $(ruby_extension)
	rm -rf src/*.o test/*.o lib/erbx/*.bundle tmp

bundle_install:
	bundle install

prism: bundle_install
	cd $(prism_path) && bundle install && bundle exec rake compile && cd -

prism_clean:
	make clean
	rm -rf $(prism_path)

format:
	$(clang_format) -i $(project_and_extension_files)

lint:
	$(clang_format) --dry-run --Werror $(project_and_extension_files)

tidy:
	$(clang_tidy) $(project_files) -- $(flags)

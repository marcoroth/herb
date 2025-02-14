exec = erbx
test_exec = run_erbx_tests

sources = $(wildcard src/*.c) $(wildcard src/**/*.c)
headers = $(wildcard src/*.h) $(wildcard src/**/*.h)
objects = $(sources:.c=.o)

extension_sources = $(wildcard ext/**/*.c)
extension_headers = $(wildcard ext/**/*.h)

project_files = $(sources) $(headers)
extension_files = $(extension_sources) $(extension_headers)
project_and_extension_files = $(project_files) $(extension_files)

test_sources = $(wildcard test/*.c)
test_objects = $(test_sources:.c=.o)
non_main_objects = $(filter-out src/main.o, $(objects))

soext ?= $(shell ruby -e 'puts RbConfig::CONFIG["DLEXT"]')
lib_name = lib$(exec).$(soext)
ruby_extension = ext/erbx/$(lib_name)

os := $(shell uname -s)

flags = -g -Wall -fPIC

ifeq ($(os),Linux)
  test_cflags = $(flags) -I/usr/include/check
  test_ldflags = -L/usr/lib/x86_64-linux-gnu -lcheck -lm -lsubunit
  llvm_path = TODO
  cc = clang
  clang_format = clang-format-19
  clang_tidy = clang-tidy
endif

ifeq ($(os),Darwin)
  brew_prefix := $(shell brew --prefix check)
  test_cflags = $(flags) -I$(brew_prefix)/include
  test_ldflags = -L$(brew_prefix)/lib -lcheck -lm
  llvm_path = /opt/homebrew/opt/llvm
  cc = $(llvm_path)/bin/clang
  clang_format = clang-format
  clang_tidy = $(llvm_path)/bin/clang-tidy
endif

all: $(exec) $(lib_name) test

$(exec): $(objects)
	gcc $(objects) $(flags) -o $(exec)

$(lib_name): $(objects)
	gcc -shared $(objects) $(flags) -o $(lib_name)
	# cp $(lib_name) $(ruby_extension)

%.o: %.c include/%.h
	gcc -c $(flags) $< -o $@

test/%.o: test/%.c
	gcc -c $(test_cflags) $< -o $@

test: $(test_objects) $(non_main_objects)
	gcc $(test_objects) $(non_main_objects) $(test_cflags) $(test_ldflags) -o $(test_exec)

clean:
	rm -f $(exec) $(test_exec) $(lib_name) $(ruby_extension)
	rm -rf src/*.o test/*.o lib/erbx/*.bundle tmp

format:
	$(clang_format) -i $(project_and_extension_files)

lint:
	$(clang_format) --dry-run --Werror $(project_and_extension_files)

tidy:
	$(clang_tidy) $(project_files) -- $(flags)

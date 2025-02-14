exec = erbx
test_exec = run_erbx_tests
prism_exec = erbx_prism

sources = $(wildcard src/*.c) $(wildcard src/**/*.c)$
sources := $(filter-out src/erbx_prism.c, $(sources))
headers = $(wildcard src/*.h) $(wildcard src/**/*.h)
objects = $(sources:.c=.o)

extension_sources = $(wildcard ext/**/*.c)
extension_headers = $(wildcard ext/**/*.h)

prism_objects = $(filter-out src/main.c, $(sources))

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

prism_path = $(shell bundle show prism)
prism_include = $(prism_path)/include
prism_build = $(prism_path)/build

flags = -g -Wall -fPIC -I$(prism_include)
ldflags = $(prism_build)/libprism.a

ifeq ($(os),Linux)
  test_cflags = $(flags) -I/usr/include/check
  test_ldflags = -L/usr/lib/x86_64-linux-gnu -lcheck -lm -lsubunit $(ldflags)
  cc = clang-19
  clang_format = clang-format-19
  clang_tidy = clang-tidy-19
endif

ifeq ($(os),Darwin)
  brew_prefix := $(shell brew --prefix check)
  test_cflags = $(flags) -I$(brew_prefix)/include
  test_ldflags = -L$(brew_prefix)/lib -lcheck -lm $(ldflags)
  llvm_path = $(shell brew --prefix llvm@19)
  cc = $(llvm_path)/bin/clang
  clang_format = $(llvm_path)/bin/clang-format
  clang_tidy = $(llvm_path)/bin/clang-tidy
endif

all: prism $(prism_exec) $(exec) $(lib_name) test

$(exec): $(objects)
	$(cc) $(objects) $(flags) $(ldflags) -o $(exec)

$(lib_name): $(objects)
	$(cc) -shared $(objects) $(flags) $(ldflags) -o $(lib_name)
	# cp $(lib_name) $(ruby_extension)

%.o: %.c include/%.h
	$(cc) -c $(flags) $< -o $@

test/%.o: test/%.c
	$(cc) -c $(test_cflags) $(flags) $< -o $@

test: $(test_objects) $(non_main_objects)
	$(cc) $(test_objects) $(non_main_objects) $(test_cflags) $(test_ldflags) -o $(test_exec)

clean:
	rm -f $(exec) $(test_exec) $(lib_name) $(ruby_extension)
	rm -rf src/*.o test/*.o lib/erbx/*.bundle tmp
	rm -rf $(prism_path)
	rm -r $(prism_exec)

bundle_install:
	bundle install
	cd $(prism_path) && bundle install && cd -

prism: bundle_install
	cd $(prism_path) && bundle exec rake compile && cd -

$(prism_exec): bundle_install prism src/erbx_prism.c $(prism_objects)
	$(cc) src/erbx_prism.c $(prism_objects) $(flags) $(ldflags) -o $(prism_exec)

format:
	$(clang_format) -i $(project_and_extension_files)

lint:
	$(clang_format) --dry-run --Werror $(project_and_extension_files)

tidy:
	$(clang_tidy) $(project_files) -- $(flags)

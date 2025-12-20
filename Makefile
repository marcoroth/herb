exec = herb
test_exec = run_herb_tests

sources = $(wildcard src/*.c) $(wildcard src/**/*.c)
headers = $(wildcard src/*.h) $(wildcard src/**/*.h)
objects = $(sources:.c=.o)

extension_sources = $(wildcard ext/**/*.c)
extension_headers = $(wildcard ext/**/*.h)
extension_objects = $(extension_sources:.o)

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

prism_vendor_path = vendor/prism
prism_include = $(prism_vendor_path)/include
prism_src = $(prism_vendor_path)/src

prism_sources = $(wildcard $(prism_src)/*.c) $(wildcard $(prism_src)/util/*.c)
prism_objects = $(prism_sources:.c=.o)
prism_static_lib = $(build_dir)/libprism.a

prism_flags = -I$(prism_include) -I$(prism_src)

warning_flags = -Wall -Wextra -Werror -pedantic
debug_flags = -g -O0 -Wno-unused-parameter
production_flags = $(warning_flags) -O3 -march=native -flto
shared_library_flags = -fPIC
flags = $(warning_flags) $(debug_flags) $(prism_flags) -std=c99
test_flags = $(debug_flags) $(prism_flags) -std=gnu99
shared_flags = $(production_flags) $(shared_library_flags) $(prism_flags)

ifeq ($(os),Linux)
  test_cflags = $(test_flags) -I/usr/include/check
  test_ldflags = -L/usr/lib/x86_64-linux-gnu -lcheck -lm -lsubunit
  cc = clang-21
  clang_format = clang-format-21
  clang_tidy = clang-tidy-21
endif

ifeq ($(os),Darwin)
  brew_prefix := $(shell brew --prefix check)
  test_cflags = $(test_flags) -I$(brew_prefix)/include
  test_ldflags = -L$(brew_prefix)/lib -lcheck -lm
  llvm_path = $(shell brew --prefix llvm@21)
  cc = $(llvm_path)/bin/clang
  clang_format = $(llvm_path)/bin/clang-format
  clang_tidy = $(llvm_path)/bin/clang-tidy
endif

all: templates prism $(exec) $(lib_name) $(static_lib_name) test wasm clangd_config

$(exec): $(objects) $(prism_objects)
	$(cc) $(objects) $(prism_objects) $(flags) $(ldflags) -o $(exec)

$(lib_name): $(objects) $(prism_objects)
	$(cc) -shared $(objects) $(prism_objects) $(shared_flags) $(ldflags) -o $(lib_name)

$(static_lib_name): $(objects)
	ar rcs $(static_lib_name) $(objects)

$(prism_static_lib): $(prism_objects)
	ar rcs $(prism_static_lib) $(prism_objects)

prism_lib: prism $(prism_static_lib)

herb_lib: templates prism $(non_main_objects)
	@echo "Herb objects built: $(non_main_objects)"

src/%.o: src/%.c templates
	$(cc) -c $(flags) -fPIC $< -o $@

$(prism_src)/%.o: $(prism_src)/%.c prism
	$(cc) -c $(flags) -fPIC $(prism_flags) $< -o $@

$(prism_src)/util/%.o: $(prism_src)/util/%.c prism
	$(cc) -c $(flags) -fPIC $(prism_flags) $< -o $@

test/%.o: test/%.c templates
	$(cc) -c $(test_cflags) $(test_flags) $(prism_flags) $< -o $@

test: $(test_objects) $(non_main_objects) $(prism_objects)
	$(cc) $(test_objects) $(non_main_objects) $(prism_objects) $(test_cflags) $(test_ldflags) -o $(test_exec)

clean:
	rm -f $(exec) $(test_exec) $(lib_name) $(shared_lib_name) $(prism_static_lib) $(ruby_extension)
	rm -rf $(objects) $(test_objects) $(prism_objects) $(extension_objects) lib/herb/*.bundle tmp
	bundle exec rake prism:clean

bundle_install:
	bundle install

templates: bundle_install
	bundle exec rake templates

prism: bundle_install
	bundle exec rake prism:vendor

format:
	$(clang_format) -i $(project_and_extension_files)

lint:
	$(clang_format) --dry-run --Werror $(project_and_extension_files)

tidy:
	$(clang_tidy) $(project_files) -- $(flags)

clangd_config:
	@echo "$(flags) $(test_cflags)" | tr ' ' '\n' | sort -u > compile_flags.txt

wasm:
	cd wasm && make

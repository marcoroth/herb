exec = erbx
test_exec = run_erbx_tests

sources = $(wildcard src/*.c)
objects = $(sources:.c=.o)

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
endif

ifeq ($(os),Darwin)
  brew_prefix := $(shell brew --prefix check)
  test_cflags = $(flags) -I$(brew_prefix)/include
  test_ldflags = -L$(brew_prefix)/lib -lcheck -lm
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
	clang-format -i $(wildcard src/*.c) $(wildcard src/**/*.c) $(wildcard src/*.h) $(wildcard src/**/*.h) $(wildcard ext/**/*.c) $(wildcard ext/**/*.h)

lint:
	clang-format --dry-run --Werror $(wildcard src/*.c) $(wildcard src/**/*.c) $(wildcard src/*.h) $(wildcard src/**/*.h) $(wildcard ext/**/*.c) $(wildcard ext/**/*.h)

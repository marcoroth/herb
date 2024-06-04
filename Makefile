exec = erbx
test_exec = run_erbx_tests

sources = $(wildcard src/*.c)
objects = $(sources:.c=.o)

test_sources = $(wildcard test/*.c)
test_objects = $(test_sources:.c=.o)
non_main_objects = $(filter-out src/main.o, $(objects))

os := $(shell uname -s)

flags = -g -Wall -fPIC

ifeq ($(os),Linux)
  test_cflags = $(flags) -I/usr/include/check
  test_ldflags = -L/usr/lib/x86_64-linux-gnu -lcheck -lm -lsubunit
  lib_name = $(exec).so
  ruby_extension = ext/erbx/$(lib_name)
endif

ifeq ($(os),Darwin)
  test_cflags = $(flags) -I/usr/local/include
  test_ldflags = -L/usr/local/lib -lcheck -lm
  lib_name = lib$(exec).so
  ruby_extension = ext/erbx/$(lib_name)
endif

all: $(exec) $(lib_name) test

$(exec): $(objects)
	gcc $(objects) $(flags) -o $(exec)

$(lib_name): $(objects)
	gcc -shared $(objects) $(flags) -o $(lib_name)
	cp $(lib_name) $(ruby_extension)

%.o: %.c include/%.h
	gcc -c $(flags) $< -o $@

test/%.o: test/%.c
	gcc -c $(test_cflags) $< -o $@

test: $(test_objects) $(non_main_objects)
	gcc $(test_objects) $(non_main_objects) $(test_cflags) $(test_ldflags) -o $(test_exec)

clean:
	rm -f $(exec) $(test_exec) $(lib_name) $(ruby_extension)
	rm -f src/*.o test/*.o

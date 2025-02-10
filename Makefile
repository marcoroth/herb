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

# Add Prism-related flags
PRISM_PATH = $(shell bundle show prism)
PRISM_INCLUDE = $(PRISM_PATH)/include
PRISM_LIB = $(PRISM_PATH)/lib
PRISM_BUILD = $(PRISM_PATH)/build

flags = -g -Wall -fPIC -I$(PRISM_INCLUDE)
ldflags = $(PRISM_BUILD)/libprism.a

ifeq ($(os),Linux)
  test_cflags = $(flags) -I/usr/include/check
  test_ldflags = -L/usr/lib/x86_64-linux-gnu -lcheck -lm -lsubunit $(ldflags)
endif

ifeq ($(os),Darwin)
  brew_prefix := $(shell brew --prefix check)
  test_cflags = $(flags) -I$(brew_prefix)/include
  test_ldflags = -L$(brew_prefix)/lib -lcheck -lm $(ldflags)
endif

all: prism $(exec) $(lib_name) test

$(exec): $(objects)
	gcc $(objects) $(flags) $(ldflags) -o $(exec) -Wl,-dead_strip_dylibs

$(lib_name): $(objects)
	gcc -shared $(objects) $(flags) $(ldflags) -o $(lib_name)

%.o: %.c include/%.h
	gcc -c $(flags) $< -o $@

test/%.o: test/%.c
	gcc -c $(test_cflags) $(flags) $< -o $@

test: $(test_objects) $(non_main_objects)
	gcc $(test_objects) $(non_main_objects) $(test_cflags) $(test_ldflags) -o $(test_exec)

clean:
	rm -f $(exec) $(test_exec) $(lib_name) $(ruby_extension)
	rm -rf src/*.o test/*.o lib/erbx/*.bundle tmp

prism/bundle_install:
	bundle install

prism: prism/bundle_install
	cd $(PRISM_PATH) && make && cd -

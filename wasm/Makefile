# Makefile for WebAssembly build of Herb

BROWSER_BUILD_DIR = ../javascript/packages/browser/build/
BROWSER_WASM_OUTPUT = $(BROWSER_BUILD_DIR)libherb.js

NODE_BUILD_DIR = ../javascript/packages/node-wasm/build/
NODE_WASM_OUTPUT = $(NODE_BUILD_DIR)libherb.js

CPP_SOURCES = $(wildcard *.cpp)
C_SOURCES = $(filter-out ../src/main.c ../src/ruby_parser.c, $(wildcard ../src/*.c)) $(wildcard ../src/**/*.c)

PRISM_PATH = $(shell cd .. && bundle show prism)
PRISM_MAIN_SOURCES = $(wildcard $(PRISM_PATH)/src/*.c)
PRISM_UTIL_SOURCES = $(wildcard $(PRISM_PATH)/src/util/*.c)
ALL_C_SOURCES = $(C_SOURCES) $(PRISM_MAIN_SOURCES) $(PRISM_UTIL_SOURCES)

OBJ_DIR = obj
C_OBJECTS = $(patsubst ../src/%.c,$(OBJ_DIR)/herb/%.o,$(C_SOURCES))
CPP_OBJECTS = $(patsubst %.cpp,$(OBJ_DIR)/%.o,$(CPP_SOURCES))
PRISM_MAIN_OBJECTS = $(patsubst $(PRISM_PATH)/src/%.c,$(OBJ_DIR)/prism/%.o,$(PRISM_MAIN_SOURCES))
PRISM_UTIL_OBJECTS = $(patsubst $(PRISM_PATH)/src/util/%.c,$(OBJ_DIR)/prism/util/%.o,$(PRISM_UTIL_SOURCES))
ALL_OBJECTS = $(C_OBJECTS) $(CPP_OBJECTS) $(PRISM_MAIN_OBJECTS) $(PRISM_UTIL_OBJECTS)

INCLUDE_DIR = ../include

PRISM_INCLUDE = $(PRISM_PATH)/include
PRISM_SRC = $(PRISM_PATH)/src
PRISM_UTIL = $(PRISM_PATH)/src/util
PRISM_EXCLUDE_FLAGS = -DPRISM_EXCLUDE_PRETTYPRINT -DPRISM_EXCLUDE_JSON -DPRISM_EXCLUDE_PACK -DPRISM_EXCLUDE_SERIALIZATION
HERB_EXCLUDE_FLAGS = -DHERB_EXCLUDE_PRETTYPRINT

OPT_FLAGS = -Oz -g0 -flto -fdata-sections -ffunction-sections

CFLAGS = -I$(INCLUDE_DIR) -I$(PRISM_INCLUDE) -I$(PRISM_SRC) -I$(PRISM_UTIL) -DPRISM_STATIC=1 -DPRISM_EXPORT_SYMBOLS=static $(PRISM_EXCLUDE_FLAGS) $(HERB_EXCLUDE_FLAGS) $(OPT_FLAGS)
WASM_FLAGS = -s WASM=1 \
             -s SINGLE_FILE=1 \
             -s EXPORT_ES6=1 \
             -s MODULARIZE=1 \
             -s EXPORT_NAME="Herb" \
             -s ALLOW_MEMORY_GROWTH=1 \
             -flto \
             --bind

all: $(BROWSER_WASM_OUTPUT) $(NODE_WASM_OUTPUT)

$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)/herb
	mkdir -p $(OBJ_DIR)/prism/util

$(OBJ_DIR)/herb/%.o: ../src/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	emcc -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/%.o: %.cpp | $(OBJ_DIR)
	@mkdir -p $(@D)
	em++ -std=c++17 -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/prism/%.o: $(PRISM_PATH)/src/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	emcc -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/prism/util/%.o: $(PRISM_PATH)/src/util/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	emcc -c $< -o $@ $(CFLAGS)

$(BROWSER_WASM_OUTPUT): $(ALL_OBJECTS)
	mkdir -p $(BROWSER_BUILD_DIR)
	em++ $(ALL_OBJECTS) $(CFLAGS) $(WASM_FLAGS) -s ENVIRONMENT='web' -o $(BROWSER_WASM_OUTPUT)

$(NODE_WASM_OUTPUT): $(ALL_OBJECTS)
	mkdir -p $(NODE_BUILD_DIR)
	em++ $(ALL_OBJECTS) $(CFLAGS) $(WASM_FLAGS) -s ENVIRONMENT='node' -o $(NODE_WASM_OUTPUT)

clean: clean_objects clean_browser clean_node

clean_objects:
	rm -rf $(OBJ_DIR)

clean_browser:
	rm -rf $(BROWSER_BUILD_DIR)

clean_node:
	rm -rf $(NODE_BUILD_DIR)

.PHONY: all clean

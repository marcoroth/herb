# Makefile for WebAssembly build of Herb

BROWSER_BUILD_DIR = ../javascript/packages/browser/build/
WASM_OUTPUT = $(BROWSER_BUILD_DIR)libherb.js

CPP_SOURCES = $(wildcard *.cpp)
C_SOURCES = $(wildcard ../src/*.c) $(wildcard ../src/**/*.c)

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

CFLAGS = -I$(INCLUDE_DIR) -I$(PRISM_INCLUDE) -I$(PRISM_SRC) -I$(PRISM_UTIL) -DPRISM_STATIC=1 -DPRISM_EXPORT_SYMBOLS=static
WASM_FLAGS = -s WASM=1 \
             -s SINGLE_FILE=1 \
             -s EXPORT_ES6=1 \
             -s MODULARIZE=1 \
             -s EXPORT_NAME="Herb" \
             -s ALLOW_MEMORY_GROWTH=1 \
             -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
             -s ENVIRONMENT='web' \
             --bind

all: $(WASM_OUTPUT)

$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)/herb
	mkdir -p $(OBJ_DIR)/prism/util

$(OBJ_DIR)/herb/%.o: ../src/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	emcc -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/%.o: %.cpp | $(OBJ_DIR)
	@mkdir -p $(@D)
	em++ -std=c++11 -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/prism/%.o: $(PRISM_PATH)/src/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	emcc -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/prism/util/%.o: $(PRISM_PATH)/src/util/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	emcc -c $< -o $@ $(CFLAGS)

$(WASM_OUTPUT): $(ALL_OBJECTS)
	mkdir -p $(BROWSER_BUILD_DIR)
	em++ $(ALL_OBJECTS) $(CFLAGS) $(WASM_FLAGS) -o $(WASM_OUTPUT)

clean:
	rm -rf $(BROWSER_BUILD_DIR)
	rm -rf $(OBJ_DIR)

.PHONY: all clean

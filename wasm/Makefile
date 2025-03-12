# Makefile for WebAssembly build of Herb

BROWSER_BUILD_DIR = ../javascript/packages/browser/build/
WASM_OUTPUT = $(BROWSER_BUILD_DIR)libherb.js

WASM_CPP_SRC = herb-wasm.cpp error_helpers.cpp extension_helpers.cpp nodes.cpp
C_SOURCES = $(wildcard ../src/*.c) $(wildcard ../src/**/*.c)
OBJ_DIR = obj

C_OBJECTS = $(patsubst ../src/%.c,$(OBJ_DIR)/%.o,$(C_SOURCES))
CPP_OBJECTS = $(OBJ_DIR)/herb-wasm.o $(OBJ_DIR)/error_helpers.o $(OBJ_DIR)/extension_helpers.o $(OBJ_DIR)/nodes.o

ALL_OBJECTS = $(C_OBJECTS) $(CPP_OBJECTS)

INCLUDE_DIR = ../include
PRISM_PATH = $(shell cd .. && bundle show prism)
PRISM_INCLUDE = $(PRISM_PATH)/include

CFLAGS = -I$(INCLUDE_DIR) -I$(PRISM_INCLUDE)
WASM_FLAGS = -s WASM=1 \
             -s SINGLE_FILE=1 \
             -s EXPORT_ES6=1 \
             -s MODULARIZE=1 \
             -s EXPORT_NAME="HerbModule" \
             -s ALLOW_MEMORY_GROWTH=1 \
             -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
             -s ENVIRONMENT='web' \
             --bind

all: $(WASM_OUTPUT)

$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)
	mkdir -p $(OBJ_DIR)/ast_nodes

$(OBJ_DIR)/%.o: ../src/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	emcc -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/herb-wasm.o: herb-wasm.cpp | $(OBJ_DIR)
	em++ -std=c++11 -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/error_helpers.o: error_helpers.cpp | $(OBJ_DIR)
	em++ -std=c++11 -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/extension_helpers.o: extension_helpers.cpp | $(OBJ_DIR)
	em++ -std=c++11 -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/nodes.o: nodes.cpp | $(OBJ_DIR)
	em++ -std=c++11 -c $< -o $@ $(CFLAGS)

$(WASM_OUTPUT): $(ALL_OBJECTS)
	mkdir -p $(BROWSER_BUILD_DIR)

	em++ $(ALL_OBJECTS) $(CFLAGS) $(WASM_FLAGS) -o $(WASM_OUTPUT)

	mkdir -p $(BROWSER_BUILD_DIR)prism/
	cp $(PRISM_PATH)/javascript/src/* $(BROWSER_BUILD_DIR)prism/

	if [ -d ../node_modules/@bjorn3/browser_wasi_shim ]; then \
		cp ../node_modules/@bjorn3/browser_wasi_shim/dist/index.js $(BROWSER_BUILD_DIR)wasi-shim.js; \
	else \
		curl -o $(BROWSER_BUILD_DIR)wasi-shim.js https://unpkg.com/@bjorn3/browser_wasi_shim@latest/dist/index.js; \
	fi

clean:
	rm -rf $(BROWSER_BUILD_DIR)
	rm -rf $(OBJ_DIR)

.PHONY: all clean

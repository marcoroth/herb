# Makefile for WebAssembly build of Herb

BROWSER_BUILD_DIR = ../javascript/packages/browser/build/
WASM_OUTPUT = $(BROWSER_BUILD_DIR)libherb.js

CPP_SOURCES = $(wildcard *.cpp)
C_SOURCES = $(wildcard ../src/*.c) $(wildcard ../src/**/*.c)
OBJ_DIR = obj

C_OBJECTS = $(patsubst ../src/%.c,$(OBJ_DIR)/%.o,$(C_SOURCES))
CPP_OBJECTS = $(patsubst %.cpp,$(OBJ_DIR)/%.o,$(CPP_SOURCES))

ALL_OBJECTS = $(C_OBJECTS) $(CPP_OBJECTS)

INCLUDE_DIR = ../include
PRISM_PATH = $(shell cd .. && bundle show prism)
PRISM_INCLUDE = $(PRISM_PATH)/include

CFLAGS = -I$(INCLUDE_DIR) -I$(PRISM_INCLUDE)
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
	mkdir -p $(OBJ_DIR)

$(OBJ_DIR)/%.o: ../src/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	emcc -c $< -o $@ $(CFLAGS)

$(OBJ_DIR)/%.o: %.cpp | $(OBJ_DIR)
	@mkdir -p $(@D)
	em++ -std=c++11 -c $< -o $@ $(CFLAGS)

$(WASM_OUTPUT): $(ALL_OBJECTS)
	# cd $(prism_path) && make wasm

	mkdir -p $(BROWSER_BUILD_DIR)

	em++ $(ALL_OBJECTS) $(CFLAGS) $(WASM_FLAGS) -o $(WASM_OUTPUT)

	mkdir -p $(BROWSER_BUILD_DIR)prism/
	cp $(PRISM_PATH)/javascript/src/* $(BROWSER_BUILD_DIR)prism/

clean:
	rm -rf $(BROWSER_BUILD_DIR)
	rm -rf $(OBJ_DIR)

.PHONY: all clean

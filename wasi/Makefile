# Makefile for building Herb for WASI

WASM_TARGET = wasm32-wasi
OUTPUT_LIB = libherb_wasi.a
OBJ_DIR = obj

# Source files
C_SOURCES := \
$(shell find ../src -name '*.c')
PRISM_PATH := $(shell cd .. && bundle show prism)
PRISM_MAIN_SOURCES := $(wildcard $(PRISM_PATH)/src/*.c)
PRISM_UTIL_SOURCES := $(wildcard $(PRISM_PATH)/src/util/*.c)

CFLAGS := -I../src/include \
-I$(PRISM_PATH)/include \
-I$(PRISM_PATH)/src \
-I$(PRISM_PATH)/src/util \
-DPRISM_STATIC=1 -DPRISM_EXPORT_SYMBOLS=static

WASM_CC ?= clang
WASM_CFLAGS := --target=$(WASM_TARGET) -O2 $(CFLAGS)

OBJECTS := \
$(patsubst ../src/%.c,$(OBJ_DIR)/herb/%.o,$(C_SOURCES)) \
$(patsubst $(PRISM_PATH)/src/%.c,$(OBJ_DIR)/prism/%.o,$(PRISM_MAIN_SOURCES)) \
$(patsubst $(PRISM_PATH)/src/util/%.c,$(OBJ_DIR)/prism/util/%.o,$(PRISM_UTIL_SOURCES))

all: $(OUTPUT_LIB)

$(OBJ_DIR):
	mkdir -p $(OBJ_DIR)/herb $(OBJ_DIR)/prism/util

$(OBJ_DIR)/herb/%.o: ../src/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	$(WASM_CC) $(WASM_CFLAGS) -c $< -o $@

$(OBJ_DIR)/prism/%.o: $(PRISM_PATH)/src/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	$(WASM_CC) $(WASM_CFLAGS) -c $< -o $@

$(OBJ_DIR)/prism/util/%.o: $(PRISM_PATH)/src/util/%.c | $(OBJ_DIR)
	@mkdir -p $(@D)
	$(WASM_CC) $(WASM_CFLAGS) -c $< -o $@

$(OUTPUT_LIB): $(OBJECTS)
	ar rcs $@ $(OBJECTS)

clean:
	rm -rf $(OBJ_DIR) $(OUTPUT_LIB)

.PHONY: all clean

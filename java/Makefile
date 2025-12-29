# Java JNI Makefile for Herb

JAVA_HOME ?= $(shell /usr/libexec/java_home 2>/dev/null || dirname $$(dirname $$(which java)))
JNI_INCLUDES = -I$(JAVA_HOME)/include

os := $(shell uname -s)

ifeq ($(os),Darwin)
  JNI_INCLUDES += -I$(JAVA_HOME)/include/darwin
  JNI_LIB_EXT = dylib
  JNI_LIB_PREFIX = lib
  LLVM_PATH = $(shell brew --prefix llvm@21)
  CC = $(LLVM_PATH)/bin/clang
else ifeq ($(os),Linux)
  JNI_INCLUDES += -I$(JAVA_HOME)/include/linux
  JNI_LIB_EXT = so
  JNI_LIB_PREFIX = lib
  CC = clang
else
  JNI_LIB_EXT = dll
  JNI_LIB_PREFIX =
  CC = clang
endif

BUILD_DIR = ../build
SRC_DIR = ../src
PRISM_VENDOR_PATH = ../vendor/prism
PRISM_SRC = $(PRISM_VENDOR_PATH)/src
PRISM_INCLUDE = $(PRISM_VENDOR_PATH)/include
PRISM_LIB = $(BUILD_DIR)/libprism.a

JAVAC = $(JAVA_HOME)/bin/javac
JAVA_CMD = $(JAVA_HOME)/bin/java
CFLAGS = -std=c99 -Wall -Wextra -fPIC -O2
HERB_CFLAGS = $(CFLAGS) -Wno-unused-parameter
PRISM_CFLAGS = -std=c99 -fPIC -O2
INCLUDES = -I. -I$(SRC_DIR)/include -I$(PRISM_INCLUDE) -I$(PRISM_SRC) $(JNI_INCLUDES)
LDFLAGS = -shared

JNI_SOURCES = herb_jni.c extension_helpers.c nodes.c error_helpers.c
JNI_OBJECTS = $(JNI_SOURCES:.c=.o)

JNI_LIB = $(BUILD_DIR)/$(JNI_LIB_PREFIX)herb_jni.$(JNI_LIB_EXT)

JAVA_SOURCES = $(shell find org -name "*.java" 2>/dev/null)
JAVA_TIMESTAMP = target/.java_compiled

.PHONY: all clean java jni setup templates prism prism_lib herb_objects help cli

all: jni java

# Setup: install deps, generate templates, vendor prism
setup:
	cd .. && bundle install
	cd .. && bundle exec rake templates
	cd .. && bundle exec rake prism:vendor

templates:
	cd .. && bundle install && bundle exec rake templates

prism:
	cd .. && bundle install && bundle exec rake prism:vendor

prism_lib: prism
	@mkdir -p $(BUILD_DIR)
	@echo "Compiling prism sources..."
	@for src in $$(find $(PRISM_SRC) -name '*.c'); do \
		obj=$${src%.c}.o; \
		if [ ! -f "$$obj" ] || [ "$$src" -nt "$$obj" ]; then \
			echo "  CC $$src"; \
			$(CC) $(PRISM_CFLAGS) -I$(PRISM_INCLUDE) -I$(PRISM_SRC) -c "$$src" -o "$$obj"; \
		fi; \
	done
	@echo "Creating prism static library..."
	ar rcs $(PRISM_LIB) $$(find $(PRISM_SRC) -name '*.o')
	@echo "Built: $(PRISM_LIB)"

herb_objects: templates
	@echo "Compiling herb sources..."
	@for src in $$(find $(SRC_DIR) -name '*.c' ! -name 'main.c'); do \
		obj=$${src%.c}.o; \
		if [ ! -f "$$obj" ] || [ "$$src" -nt "$$obj" ]; then \
			echo "  CC $$src"; \
			$(CC) $(HERB_CFLAGS) $(INCLUDES) -c "$$src" -o "$$obj"; \
		fi; \
	done
	@echo "Herb objects compiled"

jni: prism_lib herb_objects $(JNI_OBJECTS)
	@mkdir -p $(BUILD_DIR)
	$(CC) $(LDFLAGS) -o $(JNI_LIB) $(JNI_OBJECTS) $$(find $(SRC_DIR) -name '*.o' ! -name 'main.o') $(PRISM_LIB)
	@echo "Built JNI library: $(JNI_LIB)"

%.o: %.c
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

java: $(JAVA_TIMESTAMP)

$(JAVA_TIMESTAMP): $(JAVA_SOURCES)
	@mkdir -p target/classes
	@if [ -n "$(JAVA_SOURCES)" ]; then \
		$(JAVAC) -d target/classes $(JAVA_SOURCES); \
		touch $(JAVA_TIMESTAMP); \
		echo "Compiled Java classes"; \
	fi

cli: all
	@echo "CLI ready! Use: ./bin/herb-java [command] [file]"
	@echo ""
	@./bin/herb-java || true

clean:
	rm -f $(JNI_OBJECTS) $(JNI_LIB)
	rm -rf target/
	find $(SRC_DIR) -name '*.o' -delete 2>/dev/null || true
	find $(PRISM_SRC) -name '*.o' -delete 2>/dev/null || true
	rm -f $(PRISM_LIB)

help:
	@echo "Herb Java/JNI Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all          - Build everything (JNI + Java)"
	@echo "  setup        - Install deps, generate templates, vendor prism"
	@echo "  templates    - Generate code from ERB templates"
	@echo "  prism        - Vendor prism library sources"
	@echo "  prism_lib    - Compile prism static library"
	@echo "  herb_objects - Compile herb source files"
	@echo "  jni          - Build JNI shared library"
	@echo "  java         - Compile Java classes"
	@echo "  cli          - Show CLI usage"
	@echo "  clean        - Remove built files"
	@echo "  help         - Show this help"
	@echo ""
	@echo "Environment:"
	@echo "  JAVA_HOME   = $(JAVA_HOME)"
	@echo "  OS          = $(os)"
	@echo "  JNI_LIB     = $(JNI_LIB)"

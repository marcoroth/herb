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
PRISM_PATH = $(shell cd .. && bundle show prism)
PRISM_INCLUDE = $(PRISM_PATH)/include
PRISM_BUILD = $(PRISM_PATH)/build

JAVAC = $(JAVA_HOME)/bin/javac
JAVA_CMD = $(JAVA_HOME)/bin/java
CFLAGS = -std=c99 -Wall -Wextra -fPIC -O2 -DHERB_EXCLUDE_PRETTYPRINT -DPRISM_EXCLUDE_PRETTYPRINT -DPRISM_EXCLUDE_JSON -DPRISM_EXCLUDE_PACK -DPRISM_EXCLUDE_SERIALIZATION
INCLUDES = -I. -I$(SRC_DIR)/include -I$(PRISM_INCLUDE) $(JNI_INCLUDES)
LDFLAGS = -shared
LIBS = $(PRISM_BUILD)/libprism.a

HERB_SOURCES = $(wildcard $(SRC_DIR)/*.c) $(wildcard $(SRC_DIR)/**/*.c)
HERB_OBJECTS = $(filter-out $(SRC_DIR)/main.o, $(HERB_SOURCES:.c=.o))

JNI_SOURCES = herb_jni.c extension_helpers.c
JNI_GENERATED_SOURCES = nodes.c error_helpers.c

JNI_OBJECTS = $(JNI_SOURCES:.c=.o) $(JNI_GENERATED_SOURCES:.c=.o)

JNI_LIB = $(BUILD_DIR)/$(JNI_LIB_PREFIX)herb_jni.$(JNI_LIB_EXT)

JAVA_SOURCES = $(shell find org -name "*.java" 2>/dev/null)
JAVA_TIMESTAMP = target/.java_compiled
JUNIT_VERSION := 1.14.2
JUNIT_JAR := lib/junit-platform-console-standalone-$(JUNIT_VERSION).jar
JUNIT_URL := https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/$(JUNIT_VERSION)/junit-platform-console-standalone-$(JUNIT_VERSION).jar

.PHONY: lib
lib:
	@mkdir -p lib

$(JUNIT_JAR): | lib
	@if [ ! -f "$(JUNIT_JAR)" ]; then \
		echo "Downloading junit standalone $(JUNIT_VERSION)..."; \
		curl -fSL -o "$(JUNIT_JAR)" "$(JUNIT_URL)"; \
	else \
		echo "$(JUNIT_JAR) already exists"; \
	fi

.PHONY: ensure-junit
ensure-junit: $(JUNIT_JAR)
	@echo "JUnit standalone jar ensured: $(JUNIT_JAR)"

.PHONY: all
all: templates herb jni java

.PHONY: templates
templates:
	cd .. && bundle exec rake templates

.PHONY: herb
herb:
	cd .. && bundle exec rake make

.PHONY: jni
jni: $(JNI_LIB)

$(JNI_LIB): $(JNI_OBJECTS) $(HERB_OBJECTS)
	@mkdir -p $(BUILD_DIR)
	$(CC) $(LDFLAGS) -o $@ $(JNI_OBJECTS) $(HERB_OBJECTS) $(LIBS)
	@echo "Built JNI library: $(JNI_LIB)"

%.o: %.c
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

.PHONY: java
java: $(JAVA_TIMESTAMP)

$(JAVA_TIMESTAMP): $(JAVA_SOURCES) $(JUNIT_JAR)
	@mkdir -p target/classes
	@if [ -n "$(JAVA_SOURCES)" ]; then \
		$(JAVAC) -cp $(JUNIT_JAR) -d target/classes $(JAVA_SOURCES); \
		touch $(JAVA_TIMESTAMP); \
		echo "Compiled Java classes"; \
	fi

.PHONY: test
test: jni java
	$(JAVA_CMD) --enable-native-access=ALL-UNNAMED \
		-Djava.library.path=$(BUILD_DIR) \
		-jar $(JUNIT_JAR) execute \
		--class-path target/classes \
		--select-package org.herb

.PHONY: cli
cli: all
	@echo "CLI ready! Use: ./bin/herb-java [command] [file]"
	@echo ""
	@./bin/herb-java || true

.PHONY: clean
clean:
	rm -f $(JNI_OBJECTS) $(JNI_LIB)
	rm -rf target/
	rm -f nodes.o error_helpers.o

.PHONY: help
help:
	@echo "Herb Java/JNI Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all        - Build everything (templates + herb + JNI + Java)"
	@echo "  templates  - Generate code from ERB templates"
	@echo "  herb       - Compile the Herb C library"
	@echo "  jni        - Build JNI shared library"
	@echo "  java       - Compile Java classes"
	@echo "  test       - Run Java tests"
	@echo "  cli        - Show CLI usage"
	@echo "  clean      - Remove built files"
	@echo "  help       - Show this help"
	@echo ""
	@echo "Environment:"
	@echo "  JAVA_HOME   = $(JAVA_HOME)"
	@echo "  OS          = $(os)"
	@echo "  JNI_LIB     = $(JNI_LIB)"

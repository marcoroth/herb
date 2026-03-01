#define _POSIX_C_SOURCE 199309L // Enables `clock_gettime()`

#include "include/ast_node.h"
#include "include/ast_nodes.h"

#ifndef HERB_EXCLUDE_PRETTYPRINT
#  include "include/ast_pretty_print.h"
#endif

#include "include/extract.h"
#include "include/herb.h"
#include "include/io.h"
#include "include/ruby_parser.h"
#include "include/util/hb_buffer.h"
#include "include/util/string.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

void print_time_diff(const struct timespec start, const struct timespec end, const char* verb) {
  const double seconds = (double) end.tv_sec - (double) start.tv_sec;
  const double nanoseconds = (double) end.tv_nsec - (double) start.tv_nsec;
  const double total_ns = seconds * 1e9 + nanoseconds;

  const double us = total_ns / 1e3;
  const double ms = total_ns / 1e6;
  const double s = total_ns / 1e9;

  printf("Finished");
  printf(" %s ", verb);
  printf("in:\n\n");

  printf("  %8.0f µs\n", us);
  printf("  %8.3f ms\n", ms);
  printf("  %8.6f  s\n\n", s);
}

int main(const int argc, char* argv[]) {
  if (argc < 2) {
    puts("./herb [command] [options]\n");

    puts("Herb 🌿 Powerful and seamless HTML-aware ERB parsing and tooling.\n");

    puts("./herb lex [file]      -  Lex a file");
    puts("./herb parse [file]    -  Parse a file");
    puts("./herb ruby [file]     -  Extract Ruby from a file");
    puts("./herb html [file]     -  Extract HTML from a file");
    puts("./herb prism [file]    -  Extract Ruby from a file and parse the Ruby source with Prism");

    return EXIT_FAILURE;
  }

  if (argc < 3) {
    puts("Please specify input file.");
    return EXIT_FAILURE;
  }

  hb_buffer_T output;

  if (!hb_buffer_init(&output, 4096)) { return 1; }

  char* source = herb_read_file(argv[2]);

  struct timespec start, end;
  clock_gettime(CLOCK_MONOTONIC, &start);

  if (string_equals(argv[1], "lex")) {
    herb_lex_to_buffer(source, &output);
    clock_gettime(CLOCK_MONOTONIC, &end);

    puts(output.value);
    print_time_diff(start, end, "lexing");

    free(output.value);
    free(source);

    return EXIT_SUCCESS;
  }

  if (string_equals(argv[1], "parse")) {
    AST_DOCUMENT_NODE_T* root = herb_parse(source, NULL);

    clock_gettime(CLOCK_MONOTONIC, &end);

    int silent = 0;
    if (argc > 3 && string_equals(argv[3], "--silent")) { silent = 1; }

    if (!silent) {
#ifndef HERB_EXCLUDE_PRETTYPRINT
      ast_pretty_print_node((AST_NODE_T*) root, 0, 0, &output);
      puts(output.value);
#endif

      print_time_diff(start, end, "parsing");
    }

    ast_node_free((AST_NODE_T*) root);
    free(output.value);
    free(source);

    return EXIT_SUCCESS;
  }

  if (string_equals(argv[1], "ruby")) {
    herb_extract_ruby_to_buffer(source, &output);
    clock_gettime(CLOCK_MONOTONIC, &end);

    puts(output.value);
    print_time_diff(start, end, "extracting Ruby");

    free(output.value);
    free(source);

    return EXIT_SUCCESS;
  }

  if (string_equals(argv[1], "html")) {
    herb_extract_html_to_buffer(source, &output);
    clock_gettime(CLOCK_MONOTONIC, &end);

    puts(output.value);
    print_time_diff(start, end, "extracting HTML");

    free(output.value);
    free(source);

    return EXIT_SUCCESS;
  }

  if (string_equals(argv[1], "prism")) {
    printf("HTML+ERB File: \n%s\n", source);

    char* ruby_source = herb_extract(source, HERB_EXTRACT_LANGUAGE_RUBY);
    printf("Extracted Ruby: \n%s\n", ruby_source);

    herb_parse_ruby_to_stdout(ruby_source);

    free(ruby_source);
    free(output.value);
    free(source);

    return EXIT_SUCCESS;
  }

  printf("Unknown Command: %s\n", argv[1]);
  return EXIT_FAILURE;
}

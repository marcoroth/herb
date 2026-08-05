#include "../include/prism/ruby_parser.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

static bool herb_prism_visit(const pm_node_t* node, void* data) {
  const size_t* indent = (size_t*) data;

  for (size_t i = 0; i < *indent * 2; i++) {
    putc(' ', stdout);
  }

  printf("%s\n", pm_node_type_to_str(node->type));

  size_t next_indent = *indent + 1;
  size_t* next_data = &next_indent;
  pm_visit_child_nodes(node, herb_prism_visit, next_data);

  return false;
}

void herb_parse_ruby_to_stdout(char* source) {
  size_t length = strlen(source);

  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) source, length, NULL);

  pm_buffer_t buffer;
  pm_buffer_init(&buffer);

  size_t indent = 0;
  pm_node_t* root = pm_parse(&parser);
  size_t* data = &indent;

  const char* root_type = pm_node_type_to_str(root->type);
  printf("Root Type: %s\n", root_type);

  pm_visit_node(root, herb_prism_visit, data);

#ifndef PRISM_EXCLUDE_PRETTYPRINT
  pm_prettyprint(&buffer, &parser, root);
  printf("%s\n", buffer.value);
#endif

  pm_buffer_free(&buffer);
  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
}

static const char* const RUBY_FRAGMENT_PREFIXES[] = {
  "", "", "if __herb__\n", "if __herb__\n", "begin\n", "case __herb__\n"
};

static const char* const RUBY_FRAGMENT_SUFFIXES[] = { "", "\nend", "", "\nend", "\nend", "\nend" };

static bool ruby_source_parses(const char* source, size_t length) {
  pm_parser_t parser;
  pm_parser_init(&parser, (const uint8_t*) source, length, NULL);

  pm_node_t* root = pm_parse(&parser);
  bool parses = (parser.error_list.size == 0);

  if (root != NULL) { pm_node_destroy(&parser, root); }
  pm_parser_free(&parser);

  return parses;
}

bool herb_ruby_fragment_is_parseable(hb_string_T source) {
  if (source.data == NULL) { return false; }

  for (size_t index = 0; index < sizeof(RUBY_FRAGMENT_PREFIXES) / sizeof(RUBY_FRAGMENT_PREFIXES[0]); index++) {
    const char* prefix = RUBY_FRAGMENT_PREFIXES[index];
    const char* suffix = RUBY_FRAGMENT_SUFFIXES[index];

    size_t prefix_length = strlen(prefix);
    size_t suffix_length = strlen(suffix);
    size_t length = prefix_length + source.length + suffix_length;

    char* wrapped = malloc(length + 1);
    if (wrapped == NULL) { return false; }

    memcpy(wrapped, prefix, prefix_length);
    memcpy(wrapped + prefix_length, source.data, source.length);
    memcpy(wrapped + prefix_length + source.length, suffix, suffix_length);
    wrapped[length] = '\0';

    bool parses = ruby_source_parses(wrapped, length);

    free(wrapped);

    if (parses) { return true; }
  }

  return false;
}

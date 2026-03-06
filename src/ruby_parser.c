#include "include/ruby_parser.h"

#include <prism.h>
#include <stdbool.h>
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

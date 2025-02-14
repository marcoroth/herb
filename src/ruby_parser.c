#include "include/ruby_parser.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool visit(const pm_node_t* node, void* data) {
  size_t* indent = (size_t*) data;

  for (size_t i = 0; i < *indent * 2; i++) {
    putc(' ', stdout);
  }

  printf("%s\n", pm_node_type_to_str(node->type));

  size_t next_indent = *indent + 1;
  size_t* next_data = &next_indent;
  pm_visit_child_nodes(node, visit, next_data);

  return false;
}

void erbx_parse_ruby(char* source) {
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

  pm_visit_node(root, visit, data);

  pm_prettyprint(&buffer, &parser, root);
  printf("%s\n", buffer.value);

  pm_buffer_free(&buffer);
  pm_node_destroy(&parser, root);
  pm_parser_free(&parser);
}

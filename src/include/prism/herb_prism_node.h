#ifndef HERB_PRISM_NODE_H
#define HERB_PRISM_NODE_H

#include <prism.h>
#include <stdint.h>

typedef struct {
  pm_node_t* node;
  pm_parser_t* parser;
  uint32_t source_start;
  uint32_t source_end;
} herb_prism_node_T;

#define HERB_PRISM_NODE_EMPTY ((herb_prism_node_T) { .node = NULL, .parser = NULL, .source_start = 0, .source_end = 0 })

void herb_prism_node_serialize(herb_prism_node_T prism_node, pm_buffer_t* buffer);

#endif

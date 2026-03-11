#ifndef HERB_PRISM_NODE_H
#define HERB_PRISM_NODE_H

#include <prism.h>

typedef struct {
  pm_node_t* node;
  pm_parser_t* parser;
} herb_prism_node_T;

#define HERB_PRISM_NODE_EMPTY ((herb_prism_node_T) { .node = NULL, .parser = NULL })

#endif

#ifndef HERB_DIFF_H
#define HERB_DIFF_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "../ast/ast_nodes.h"
#include "../lib/hb_allocator.h"
#include "../lib/hb_array.h"
#include "herb_hash.h"
#include "herb_hash_map.h"

#define HERB_DIFF_PATH_MAX_DEPTH 64

typedef enum {
  HERB_DIFF_NODE_INSERTED,
  HERB_DIFF_NODE_REMOVED,
  HERB_DIFF_NODE_REPLACED,
  HERB_DIFF_NODE_MOVED,

  HERB_DIFF_TEXT_CHANGED,
  HERB_DIFF_ERB_CONTENT_CHANGED,

  HERB_DIFF_ATTRIBUTE_ADDED,
  HERB_DIFF_ATTRIBUTE_REMOVED,
  HERB_DIFF_ATTRIBUTE_VALUE_CHANGED,

  HERB_DIFF_TAG_NAME_CHANGED,

  HERB_DIFF_NODE_WRAPPED,
  HERB_DIFF_NODE_UNWRAPPED,
} herb_diff_operation_type_T;

typedef struct {
  uint32_t indices[HERB_DIFF_PATH_MAX_DEPTH];
  uint16_t depth;
} herb_diff_path_T;

typedef struct {
  herb_diff_operation_type_T type;
  herb_diff_path_T path;
  const AST_NODE_T* old_node;
  const AST_NODE_T* new_node;
  uint32_t old_index;
  uint32_t new_index;
} herb_diff_operation_T;

typedef struct {
  hb_array_T* operations;
  hb_allocator_T* allocator;
  bool trees_identical;
} herb_diff_result_T;

herb_diff_path_T herb_diff_path_empty(void);
herb_diff_path_T herb_diff_path_append(herb_diff_path_T path, uint32_t index);

herb_diff_result_T* herb_diff(
  const AST_DOCUMENT_NODE_T* old_document,
  const AST_DOCUMENT_NODE_T* new_document,
  hb_allocator_T* allocator
);

size_t herb_diff_operation_count(const herb_diff_result_T* result);
const herb_diff_operation_T* herb_diff_operation_at(const herb_diff_result_T* result, size_t index);
bool herb_diff_trees_identical(const herb_diff_result_T* result);
const char* herb_diff_operation_type_to_string(herb_diff_operation_type_T type);

void herb_diff_node(
  const AST_NODE_T* old_node,
  const AST_NODE_T* new_node,
  herb_diff_path_T path,
  const herb_hash_map_T* old_hashes,
  const herb_hash_map_T* new_hashes,
  herb_diff_result_T* result
);

void herb_diff_children(
  const hb_array_T* old_children,
  const hb_array_T* new_children,
  herb_diff_path_T parent_path,
  const herb_hash_map_T* old_hashes,
  const herb_hash_map_T* new_hashes,
  herb_diff_result_T* result
);

void herb_diff_attributes(
  const hb_array_T* old_attributes,
  const hb_array_T* new_attributes,
  herb_diff_path_T parent_path,
  const herb_hash_map_T* old_hashes,
  const herb_hash_map_T* new_hashes,
  herb_diff_result_T* result
);

void herb_diff_emit_operation(
  herb_diff_result_T* result,
  herb_diff_operation_type_T type,
  herb_diff_path_T path,
  const AST_NODE_T* old_node,
  const AST_NODE_T* new_node,
  uint32_t old_index,
  uint32_t new_index
);

const hb_array_T* herb_diff_get_node_children(const AST_NODE_T* node);

const AST_NODE_T* herb_diff_find_child_by_hash(
  const AST_NODE_T* parent,
  herb_hash_T target_hash,
  const herb_hash_map_T* hash_map
);

herb_hash_T herb_hash_tree(const AST_NODE_T* node, herb_hash_map_T* hash_map);
herb_hash_T herb_hash_node_identity(const AST_NODE_T* node, const herb_hash_map_T* hash_map);
herb_hash_T herb_hash_node_move_identity(const AST_NODE_T* node, const herb_hash_map_T* hash_map);

#endif

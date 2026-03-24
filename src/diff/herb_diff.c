#include "../include/diff/herb_diff.h"

herb_diff_path_T herb_diff_path_empty(void) {
  herb_diff_path_T path;
  path.depth = 0;
  return path;
}

herb_diff_path_T herb_diff_path_append(const herb_diff_path_T path, const uint32_t index) {
  herb_diff_path_T result = path;

  if (result.depth < HERB_DIFF_PATH_MAX_DEPTH) {
    result.indices[result.depth] = index;
    result.depth++;
  }

  return result;
}

static void emit_operation(
  herb_diff_result_T* result,
  const herb_diff_operation_type_T type,
  const herb_diff_path_T path,
  const AST_NODE_T* old_node,
  const AST_NODE_T* new_node,
  const uint32_t old_index,
  const uint32_t new_index
) {
  herb_diff_operation_T* operation =
    (herb_diff_operation_T*) hb_allocator_alloc(result->allocator, sizeof(herb_diff_operation_T));

  operation->type = type;
  operation->path = path;
  operation->old_node = old_node;
  operation->new_node = new_node;
  operation->old_index = old_index;
  operation->new_index = new_index;

  hb_array_append(result->operations, operation);
}

herb_diff_result_T* herb_diff(
  const AST_DOCUMENT_NODE_T* old_document,
  const AST_DOCUMENT_NODE_T* new_document,
  hb_allocator_T* allocator
) {
  herb_diff_result_T* result = (herb_diff_result_T*) hb_allocator_alloc(allocator, sizeof(herb_diff_result_T));
  result->operations = hb_array_init(16, allocator);
  result->allocator = allocator;
  result->trees_identical = false;

  herb_hash_map_T old_hashes;
  herb_hash_map_T new_hashes;
  herb_hash_map_init(&old_hashes, 256, allocator);
  herb_hash_map_init(&new_hashes, 256, allocator);

  herb_hash_T old_root_hash = herb_hash_tree((const AST_NODE_T*) old_document, &old_hashes);
  herb_hash_T new_root_hash = herb_hash_tree((const AST_NODE_T*) new_document, &new_hashes);

  if (old_root_hash == new_root_hash) {
    result->trees_identical = true;
    return result;
  }

  herb_diff_path_T root_path = herb_diff_path_empty();

  herb_diff_node(
    (const AST_NODE_T*) old_document,
    (const AST_NODE_T*) new_document,
    root_path,
    &old_hashes,
    &new_hashes,
    result
  );

  return result;
}

size_t herb_diff_operation_count(const herb_diff_result_T* result) {
  if (result == NULL || result->operations == NULL) { return 0; }

  return hb_array_size(result->operations);
}

const herb_diff_operation_T* herb_diff_operation_at(const herb_diff_result_T* result, const size_t index) {
  if (result == NULL || result->operations == NULL) { return NULL; }

  return (const herb_diff_operation_T*) hb_array_get(result->operations, index);
}

bool herb_diff_trees_identical(const herb_diff_result_T* result) {
  if (result == NULL) { return false; }

  return result->trees_identical;
}

const char* herb_diff_operation_type_to_string(const herb_diff_operation_type_T type) {
  switch (type) {
    case HERB_DIFF_NODE_INSERTED: return "node_inserted";
    case HERB_DIFF_NODE_REMOVED: return "node_removed";
    case HERB_DIFF_NODE_REPLACED: return "node_replaced";
    case HERB_DIFF_NODE_MOVED: return "node_moved";
    case HERB_DIFF_TEXT_CHANGED: return "text_changed";
    case HERB_DIFF_ERB_CONTENT_CHANGED: return "erb_content_changed";
    case HERB_DIFF_ATTRIBUTE_ADDED: return "attribute_added";
    case HERB_DIFF_ATTRIBUTE_REMOVED: return "attribute_removed";
    case HERB_DIFF_ATTRIBUTE_VALUE_CHANGED: return "attribute_value_changed";
    case HERB_DIFF_TAG_NAME_CHANGED: return "tag_name_changed";
    case HERB_DIFF_NODE_WRAPPED: return "node_wrapped";
    case HERB_DIFF_NODE_UNWRAPPED: return "node_unwrapped";
  }

  return "unknown";
}

void herb_diff_emit_operation(
  herb_diff_result_T* result,
  const herb_diff_operation_type_T type,
  const herb_diff_path_T path,
  const AST_NODE_T* old_node,
  const AST_NODE_T* new_node,
  const uint32_t old_index,
  const uint32_t new_index
) {
  emit_operation(result, type, path, old_node, new_node, old_index, new_index);
}

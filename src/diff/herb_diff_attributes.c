#include "../include/diff/herb_diff.h"

void herb_diff_attributes(
  const hb_array_T* old_attributes,
  const hb_array_T* new_attributes,
  const herb_diff_path_T parent_path,
  const herb_hash_map_T* old_hashes,
  const herb_hash_map_T* new_hashes,
  herb_diff_result_T* result
) {
  if (old_attributes == NULL && new_attributes == NULL) { return; }

  if (old_attributes == NULL) {
    for (size_t index = 0; index < hb_array_size(new_attributes); index++) {
      const AST_NODE_T* new_attribute = (const AST_NODE_T*) hb_array_get(new_attributes, index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_ATTRIBUTE_ADDED,
        herb_diff_path_append(parent_path, (uint32_t) index),
        NULL,
        new_attribute,
        0,
        (uint32_t) index
      );
    }

    return;
  }

  if (new_attributes == NULL) {
    for (size_t index = 0; index < hb_array_size(old_attributes); index++) {
      const AST_NODE_T* old_attribute = (const AST_NODE_T*) hb_array_get(old_attributes, index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_ATTRIBUTE_REMOVED,
        herb_diff_path_append(parent_path, (uint32_t) index),
        old_attribute,
        NULL,
        (uint32_t) index,
        0
      );
    }

    return;
  }

  const size_t old_size = hb_array_size(old_attributes);
  const size_t new_size = hb_array_size(new_attributes);

  if (old_size == 0) {
    for (size_t index = 0; index < new_size; index++) {
      const AST_NODE_T* new_attribute = (const AST_NODE_T*) hb_array_get(new_attributes, index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_ATTRIBUTE_ADDED,
        herb_diff_path_append(parent_path, (uint32_t) index),
        NULL,
        new_attribute,
        0,
        (uint32_t) index
      );
    }

    return;
  }

  if (new_size == 0) {
    for (size_t index = 0; index < old_size; index++) {
      const AST_NODE_T* old_attribute = (const AST_NODE_T*) hb_array_get(old_attributes, index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_ATTRIBUTE_REMOVED,
        herb_diff_path_append(parent_path, (uint32_t) index),
        old_attribute,
        NULL,
        (uint32_t) index,
        0
      );
    }

    return;
  }

  bool* old_matched = (bool*) hb_allocator_alloc(result->allocator, old_size * sizeof(bool));

  for (size_t index = 0; index < old_size; index++) {
    old_matched[index] = false;
  }

  for (size_t new_index = 0; new_index < new_size; new_index++) {
    const AST_NODE_T* new_node = (const AST_NODE_T*) hb_array_get(new_attributes, new_index);

    if (new_node->type != AST_HTML_ATTRIBUTE_NODE) {
      bool found = false;

      for (size_t old_index = 0; old_index < old_size; old_index++) {
        if (old_matched[old_index]) { continue; }

        const AST_NODE_T* old_node = (const AST_NODE_T*) hb_array_get(old_attributes, old_index);

        if (old_node->type == new_node->type) {
          old_matched[old_index] = true;
          found = true;

          herb_hash_T old_hash = herb_hash_map_get(old_hashes, old_node);
          herb_hash_T new_hash = herb_hash_map_get(new_hashes, new_node);

          if (old_hash != new_hash) {
            herb_diff_node(
              old_node,
              new_node,
              herb_diff_path_append(parent_path, (uint32_t) new_index),
              old_hashes,
              new_hashes,
              result
            );
          }

          break;
        }
      }

      if (!found) {
        herb_diff_emit_operation(
          result,
          HERB_DIFF_ATTRIBUTE_ADDED,
          herb_diff_path_append(parent_path, (uint32_t) new_index),
          NULL,
          new_node,
          0,
          (uint32_t) new_index
        );
      }

      continue;
    }

    const AST_HTML_ATTRIBUTE_NODE_T* new_attribute = (const AST_HTML_ATTRIBUTE_NODE_T*) new_node;
    herb_hash_T new_name_hash = herb_hash_map_get(new_hashes, (const AST_NODE_T*) new_attribute->name);

    bool found = false;

    for (size_t old_index = 0; old_index < old_size; old_index++) {
      if (old_matched[old_index]) { continue; }

      const AST_NODE_T* old_node = (const AST_NODE_T*) hb_array_get(old_attributes, old_index);
      if (old_node->type != AST_HTML_ATTRIBUTE_NODE) { continue; }

      const AST_HTML_ATTRIBUTE_NODE_T* old_attribute = (const AST_HTML_ATTRIBUTE_NODE_T*) old_node;
      herb_hash_T old_name_hash = herb_hash_map_get(old_hashes, (const AST_NODE_T*) old_attribute->name);

      if (old_name_hash == new_name_hash) {
        old_matched[old_index] = true;
        found = true;

        herb_hash_T old_value_hash = herb_hash_map_get(old_hashes, (const AST_NODE_T*) old_attribute->value);
        herb_hash_T new_value_hash = herb_hash_map_get(new_hashes, (const AST_NODE_T*) new_attribute->value);

        if (old_value_hash != new_value_hash) {
          herb_diff_emit_operation(
            result,
            HERB_DIFF_ATTRIBUTE_VALUE_CHANGED,
            herb_diff_path_append(parent_path, (uint32_t) new_index),
            old_node,
            new_node,
            (uint32_t) old_index,
            (uint32_t) new_index
          );
        }

        break;
      }
    }

    if (!found) {
      herb_diff_emit_operation(
        result,
        HERB_DIFF_ATTRIBUTE_ADDED,
        herb_diff_path_append(parent_path, (uint32_t) new_index),
        NULL,
        new_node,
        0,
        (uint32_t) new_index
      );
    }
  }

  for (size_t old_index = 0; old_index < old_size; old_index++) {
    if (!old_matched[old_index]) {
      const AST_NODE_T* old_node = (const AST_NODE_T*) hb_array_get(old_attributes, old_index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_ATTRIBUTE_REMOVED,
        herb_diff_path_append(parent_path, (uint32_t) old_index),
        old_node,
        NULL,
        (uint32_t) old_index,
        0
      );
    }
  }
}

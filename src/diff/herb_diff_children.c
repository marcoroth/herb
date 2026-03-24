#include "../include/diff/herb_diff.h"
#include "../include/macros.h"

#include <string.h>

#define LCS_MAX_SIZE 256

typedef enum {
  EDIT_KEEP,
  EDIT_INSERT,
  EDIT_DELETE,
  EDIT_MOVE,
  EDIT_CONSUMED,
  EDIT_COALESCED_KEEP,
  EDIT_WRAP,
  EDIT_UNWRAP,
} edit_type_T;

typedef struct {
  edit_type_T type;
  size_t old_index;
  size_t new_index;
} edit_entry_T;

static size_t element_attribute_count(const AST_NODE_T* node) {
  if (node->type == AST_HTML_ELEMENT_NODE) {
    const AST_HTML_ELEMENT_NODE_T* element = (const AST_HTML_ELEMENT_NODE_T*) node;

    if (element->open_tag != NULL) {
      const AST_HTML_OPEN_TAG_NODE_T* open_tag = (const AST_HTML_OPEN_TAG_NODE_T*) element->open_tag;

      if (open_tag->children != NULL) { return hb_array_size(open_tag->children); }
    }
  }

  if (node->type == AST_HTML_CONDITIONAL_ELEMENT_NODE) {
    const AST_HTML_CONDITIONAL_ELEMENT_NODE_T* element = (const AST_HTML_CONDITIONAL_ELEMENT_NODE_T*) node;

    if (element->open_tag != NULL && element->open_tag->children != NULL) {
      return hb_array_size(element->open_tag->children);
    }
  }

  return 0;
}

static bool nodes_match(
  const AST_NODE_T* old_node,
  const AST_NODE_T* new_node,
  const herb_hash_map_T* old_hashes,
  const herb_hash_map_T* new_hashes
) {
  if (old_node == NULL || new_node == NULL) { return false; }

  herb_hash_T old_hash = herb_hash_map_get(old_hashes, old_node);
  herb_hash_T new_hash = herb_hash_map_get(new_hashes, new_node);

  if (old_hash == new_hash) { return true; }
  if (old_node->type != new_node->type) { return false; }

  if (old_node->type == AST_HTML_ELEMENT_NODE || old_node->type == AST_HTML_CONDITIONAL_ELEMENT_NODE) {
    herb_hash_T old_identity = herb_hash_node_identity(old_node, old_hashes);
    herb_hash_T new_identity = herb_hash_node_identity(new_node, new_hashes);

    if (old_identity != new_identity) { return false; }

    if (element_attribute_count(old_node) == 0 || element_attribute_count(new_node) == 0) { return true; }

    herb_hash_T old_move_identity = herb_hash_node_move_identity(old_node, old_hashes);
    herb_hash_T new_move_identity = herb_hash_node_move_identity(new_node, new_hashes);

    return old_move_identity == new_move_identity;
  }

  return true;
}

static void diff_children_linear(
  const hb_array_T* old_children,
  const hb_array_T* new_children,
  const herb_diff_path_T parent_path,
  const herb_hash_map_T* old_hashes,
  const herb_hash_map_T* new_hashes,
  herb_diff_result_T* result
) {
  const size_t old_size = hb_array_size(old_children);
  const size_t new_size = hb_array_size(new_children);

  size_t common_prefix = 0;

  while (common_prefix < old_size && common_prefix < new_size) {
    const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, common_prefix);
    const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, common_prefix);
    herb_hash_T old_hash = herb_hash_map_get(old_hashes, old_child);
    herb_hash_T new_hash = herb_hash_map_get(new_hashes, new_child);

    if (old_hash != new_hash) { break; }

    common_prefix++;
  }

  size_t common_suffix = 0;

  while (common_suffix < (old_size - common_prefix) && common_suffix < (new_size - common_prefix)) {
    const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, old_size - 1 - common_suffix);
    const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, new_size - 1 - common_suffix);

    herb_hash_T old_hash = herb_hash_map_get(old_hashes, old_child);
    herb_hash_T new_hash = herb_hash_map_get(new_hashes, new_child);

    if (old_hash != new_hash) { break; }

    common_suffix++;
  }

  const size_t old_middle_start = common_prefix;
  const size_t old_middle_end = old_size - common_suffix;
  const size_t new_middle_start = common_prefix;
  const size_t new_middle_end = new_size - common_suffix;

  for (size_t index = old_middle_start; index < old_middle_end; index++) {
    const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, index);

    herb_diff_emit_operation(
      result,
      HERB_DIFF_NODE_REMOVED,
      herb_diff_path_append(parent_path, (uint32_t) index),
      old_child,
      NULL,
      (uint32_t) index,
      0
    );
  }

  for (size_t index = new_middle_start; index < new_middle_end; index++) {
    const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, index);

    herb_diff_emit_operation(
      result,
      HERB_DIFF_NODE_INSERTED,
      herb_diff_path_append(parent_path, (uint32_t) index),
      NULL,
      new_child,
      0,
      (uint32_t) index
    );
  }
}

void herb_diff_children(
  const hb_array_T* old_children,
  const hb_array_T* new_children,
  const herb_diff_path_T parent_path,
  const herb_hash_map_T* old_hashes,
  const herb_hash_map_T* new_hashes,
  herb_diff_result_T* result
) {
  if (old_children == NULL && new_children == NULL) { return; }

  if (old_children == NULL) {
    for (size_t index = 0; index < hb_array_size(new_children); index++) {
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_NODE_INSERTED,
        herb_diff_path_append(parent_path, (uint32_t) index),
        NULL,
        new_child,
        0,
        (uint32_t) index
      );
    }

    return;
  }

  if (new_children == NULL) {
    for (size_t index = 0; index < hb_array_size(old_children); index++) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_NODE_REMOVED,
        herb_diff_path_append(parent_path, (uint32_t) index),
        old_child,
        NULL,
        (uint32_t) index,
        0
      );
    }

    return;
  }

  const size_t old_size = hb_array_size(old_children);
  const size_t new_size = hb_array_size(new_children);

  if (old_size == 0 && new_size == 0) { return; }

  if (old_size > LCS_MAX_SIZE || new_size > LCS_MAX_SIZE) {
    diff_children_linear(old_children, new_children, parent_path, old_hashes, new_hashes, result);
    return;
  }

  const size_t table_width = new_size + 1;
  const size_t table_size = (old_size + 1) * table_width;
  size_t* lcs_table = (size_t*) hb_allocator_alloc(result->allocator, table_size * sizeof(size_t));
  memset(lcs_table, 0, table_size * sizeof(size_t));

  for (size_t old_index = 1; old_index <= old_size; old_index++) {
    for (size_t new_index = 1; new_index <= new_size; new_index++) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, old_index - 1);
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, new_index - 1);

      if (nodes_match(old_child, new_child, old_hashes, new_hashes)) {
        lcs_table[old_index * table_width + new_index] = lcs_table[(old_index - 1) * table_width + (new_index - 1)] + 1;
      } else {
        const size_t from_old = lcs_table[(old_index - 1) * table_width + new_index];
        const size_t from_new = lcs_table[old_index * table_width + (new_index - 1)];
        lcs_table[old_index * table_width + new_index] = MAX(from_old, from_new);
      }
    }
  }

  size_t edit_capacity = old_size + new_size;
  size_t edit_count = 0;

  edit_entry_T* edit_script =
    (edit_entry_T*) hb_allocator_alloc(result->allocator, edit_capacity * sizeof(edit_entry_T));

  size_t old_index = old_size;
  size_t new_index = new_size;

  while (old_index > 0 || new_index > 0) {
    if (old_index > 0 && new_index > 0) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, old_index - 1);
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, new_index - 1);

      if (nodes_match(old_child, new_child, old_hashes, new_hashes)) {
        edit_script[edit_count].type = EDIT_KEEP;
        edit_script[edit_count].old_index = old_index - 1;
        edit_script[edit_count].new_index = new_index - 1;
        edit_count++;

        old_index--;
        new_index--;

        continue;
      }
    }

    if (new_index > 0
        && (old_index == 0 || lcs_table[old_index * table_width + (new_index - 1)] >= lcs_table[(old_index - 1) * table_width + new_index])) {
      edit_script[edit_count].type = EDIT_INSERT;
      edit_script[edit_count].old_index = 0;
      edit_script[edit_count].new_index = new_index - 1;
      edit_count++;
      new_index--;
    } else {
      edit_script[edit_count].type = EDIT_DELETE;
      edit_script[edit_count].old_index = old_index - 1;
      edit_script[edit_count].new_index = 0;
      edit_count++;
      old_index--;
    }
  }

  size_t remove_count = 0;
  size_t insert_count = 0;

  for (size_t index = 0; index < edit_count; index++) {
    if (edit_script[index].type == EDIT_DELETE) { remove_count++; }
    if (edit_script[index].type == EDIT_INSERT) { insert_count++; }
  }

  bool* remove_matched = NULL;
  bool* insert_matched = NULL;

  if (remove_count > 0 && insert_count > 0) {
    size_t remove_alloc = remove_count * sizeof(size_t);
    size_t insert_alloc = insert_count * sizeof(size_t);

    size_t* remove_indices = (size_t*) hb_allocator_alloc(result->allocator, remove_alloc);
    size_t* insert_indices = (size_t*) hb_allocator_alloc(result->allocator, insert_alloc);

    remove_matched = (bool*) hb_allocator_alloc(result->allocator, remove_count * sizeof(bool));
    insert_matched = (bool*) hb_allocator_alloc(result->allocator, insert_count * sizeof(bool));

    size_t remove_position = 0;
    size_t insert_position = 0;

    for (size_t index = 0; index < edit_count; index++) {
      if (edit_script[index].type == EDIT_DELETE) {
        remove_indices[remove_position] = index;
        remove_matched[remove_position] = false;
        remove_position++;
      }

      if (edit_script[index].type == EDIT_INSERT) {
        insert_indices[insert_position] = index;
        insert_matched[insert_position] = false;
        insert_position++;
      }
    }

    for (size_t remove_index = 0; remove_index < remove_count; remove_index++) {
      if (remove_matched[remove_index]) { continue; }

      const edit_entry_T* remove_entry = &edit_script[remove_indices[remove_index]];
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, remove_entry->old_index);
      herb_hash_T old_identity = herb_hash_node_move_identity(old_child, old_hashes);

      for (size_t insert_index = 0; insert_index < insert_count; insert_index++) {
        if (insert_matched[insert_index]) { continue; }

        const edit_entry_T* insert_entry = &edit_script[insert_indices[insert_index]];
        const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, insert_entry->new_index);
        herb_hash_T new_identity = herb_hash_node_move_identity(new_child, new_hashes);

        if (old_identity == new_identity) {
          remove_matched[remove_index] = true;
          insert_matched[insert_index] = true;

          edit_script[remove_indices[remove_index]].type = EDIT_MOVE;
          edit_script[remove_indices[remove_index]].new_index = insert_entry->new_index;
          edit_script[insert_indices[insert_index]].type = EDIT_CONSUMED;

          break;
        }
      }
    }

    for (size_t remove_index = 0; remove_index < remove_count; remove_index++) {
      if (remove_matched[remove_index]) { continue; }

      const edit_entry_T* remove_entry = &edit_script[remove_indices[remove_index]];
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, remove_entry->old_index);
      herb_hash_T old_tag_identity = herb_hash_node_identity(old_child, old_hashes);

      for (size_t insert_index = 0; insert_index < insert_count; insert_index++) {
        if (insert_matched[insert_index]) { continue; }

        const edit_entry_T* insert_entry = &edit_script[insert_indices[insert_index]];
        const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, insert_entry->new_index);

        herb_hash_T new_tag_identity = herb_hash_node_identity(new_child, new_hashes);

        if (old_tag_identity == new_tag_identity) {
          remove_matched[remove_index] = true;
          insert_matched[insert_index] = true;

          edit_script[remove_indices[remove_index]].type = EDIT_COALESCED_KEEP;
          edit_script[remove_indices[remove_index]].new_index = insert_entry->new_index;
          edit_script[insert_indices[insert_index]].type = EDIT_CONSUMED;

          break;
        }
      }
    }

    for (size_t remove_index = 0; remove_index < remove_count; remove_index++) {
      if (remove_matched[remove_index]) { continue; }

      const edit_entry_T* remove_entry = &edit_script[remove_indices[remove_index]];
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, remove_entry->old_index);
      herb_hash_T old_hash = herb_hash_map_get(old_hashes, old_child);

      for (size_t insert_index = 0; insert_index < insert_count; insert_index++) {
        if (insert_matched[insert_index]) { continue; }

        const edit_entry_T* insert_entry = &edit_script[insert_indices[insert_index]];
        const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, insert_entry->new_index);
        herb_hash_T new_hash = herb_hash_map_get(new_hashes, new_child);

        const AST_NODE_T* found_in_new = herb_diff_find_child_by_hash(new_child, old_hash, new_hashes);

        if (found_in_new != NULL) {
          remove_matched[remove_index] = true;
          insert_matched[insert_index] = true;

          edit_script[remove_indices[remove_index]].type = EDIT_WRAP;
          edit_script[remove_indices[remove_index]].new_index = insert_entry->new_index;
          edit_script[insert_indices[insert_index]].type = EDIT_CONSUMED;

          break;
        }

        const AST_NODE_T* found_in_old = herb_diff_find_child_by_hash(old_child, new_hash, old_hashes);

        if (found_in_old != NULL) {
          remove_matched[remove_index] = true;
          insert_matched[insert_index] = true;

          edit_script[remove_indices[remove_index]].type = EDIT_UNWRAP;
          edit_script[remove_indices[remove_index]].new_index = insert_entry->new_index;
          edit_script[insert_indices[insert_index]].type = EDIT_CONSUMED;

          break;
        }
      }
    }
  }

  for (size_t index = edit_count; index > 0; index--) {
    const edit_entry_T* entry = &edit_script[index - 1];

    if (entry->type == EDIT_KEEP) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, entry->old_index);
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, entry->new_index);

      herb_diff_path_T child_path = herb_diff_path_append(parent_path, (uint32_t) entry->new_index);
      herb_diff_node(old_child, new_child, child_path, old_hashes, new_hashes, result);
    } else if (entry->type == EDIT_INSERT) {
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, entry->new_index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_NODE_INSERTED,
        herb_diff_path_append(parent_path, (uint32_t) entry->new_index),
        NULL,
        new_child,
        0,
        (uint32_t) entry->new_index
      );
    } else if (entry->type == EDIT_DELETE) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, entry->old_index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_NODE_REMOVED,
        herb_diff_path_append(parent_path, (uint32_t) entry->old_index),
        old_child,
        NULL,
        (uint32_t) entry->old_index,
        0
      );
    } else if (entry->type == EDIT_MOVE) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, entry->old_index);
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, entry->new_index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_NODE_MOVED,
        herb_diff_path_append(parent_path, (uint32_t) entry->new_index),
        old_child,
        new_child,
        (uint32_t) entry->old_index,
        (uint32_t) entry->new_index
      );

      herb_diff_path_T child_path = herb_diff_path_append(parent_path, (uint32_t) entry->new_index);
      herb_diff_node(old_child, new_child, child_path, old_hashes, new_hashes, result);
    } else if (entry->type == EDIT_COALESCED_KEEP) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, entry->old_index);
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, entry->new_index);
      herb_diff_path_T child_path = herb_diff_path_append(parent_path, (uint32_t) entry->new_index);

      if (entry->old_index != entry->new_index) {
        herb_diff_emit_operation(
          result,
          HERB_DIFF_NODE_MOVED,
          child_path,
          old_child,
          new_child,
          (uint32_t) entry->old_index,
          (uint32_t) entry->new_index
        );
      }

      herb_diff_node(old_child, new_child, child_path, old_hashes, new_hashes, result);
    } else if (entry->type == EDIT_WRAP) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, entry->old_index);
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, entry->new_index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_NODE_WRAPPED,
        herb_diff_path_append(parent_path, (uint32_t) entry->new_index),
        old_child,
        new_child,
        (uint32_t) entry->old_index,
        (uint32_t) entry->new_index
      );
    } else if (entry->type == EDIT_UNWRAP) {
      const AST_NODE_T* old_child = (const AST_NODE_T*) hb_array_get(old_children, entry->old_index);
      const AST_NODE_T* new_child = (const AST_NODE_T*) hb_array_get(new_children, entry->new_index);

      herb_diff_emit_operation(
        result,
        HERB_DIFF_NODE_UNWRAPPED,
        herb_diff_path_append(parent_path, (uint32_t) entry->new_index),
        old_child,
        new_child,
        (uint32_t) entry->old_index,
        (uint32_t) entry->new_index
      );
    }
  }
}

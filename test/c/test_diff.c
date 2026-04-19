#include "include/test.h"

#include "../../src/include/herb.h"
#include "../../src/include/diff/herb_diff.h"
#include "../../src/include/lib/hb_allocator.h"

static herb_diff_result_T* diff_sources(const char* old_source, const char* new_source, hb_allocator_T* allocator) {
  parser_options_T options = HERB_DEFAULT_PARSER_OPTIONS;

  hb_allocator_T old_allocator;
  hb_allocator_T new_allocator;
  hb_allocator_init(&old_allocator, HB_ALLOCATOR_ARENA);
  hb_allocator_init(&new_allocator, HB_ALLOCATOR_ARENA);

  AST_DOCUMENT_NODE_T* old_document = herb_parse(old_source, &options, &old_allocator);
  AST_DOCUMENT_NODE_T* new_document = herb_parse(new_source, &options, &new_allocator);

  return herb_diff(old_document, new_document, allocator);
}

TEST(test_diff_identical_documents)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div>Hello</div>", "<div>Hello</div>", &allocator);

  ck_assert(herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 0);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_text_changed)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div>Hello</div>", "<div>World</div>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_TEXT_CHANGED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_attribute_value_changed)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div class=\"old\">Hi</div>", "<div class=\"new\">Hi</div>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_ATTRIBUTE_VALUE_CHANGED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_attribute_added)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div>Hi</div>", "<div class=\"new\">Hi</div>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_ATTRIBUTE_ADDED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_attribute_removed)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div class=\"old\">Hi</div>", "<div>Hi</div>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_ATTRIBUTE_REMOVED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_node_inserted)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div></div>", "<div><span>New</span></div>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_NODE_INSERTED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_node_removed)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div><span>Old</span></div>", "<div></div>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_NODE_REMOVED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_erb_content_changed)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<%= foo %>", "<%= bar %>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_ERB_CONTENT_CHANGED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_node_moved_with_attributes)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<ul><li class=\"a\">A</li><li class=\"b\">B</li></ul>",
    "<ul><li class=\"b\">B</li><li class=\"a\">A</li></ul>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));

  bool has_move = false;
  for (size_t index = 0; index < herb_diff_operation_count(result); index++) {
    if (herb_diff_operation_at(result, index)->type == HERB_DIFF_NODE_MOVED) { has_move = true; }
  }
  ck_assert(has_move);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_plain_reorder_no_move)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<ul><li>A</li><li>B</li></ul>",
    "<ul><li>B</li><li>A</li></ul>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));

  for (size_t index = 0; index < herb_diff_operation_count(result); index++) {
    ck_assert_uint_ne(herb_diff_operation_at(result, index)->type, HERB_DIFF_NODE_MOVED);
  }

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_move_with_attribute_change)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<div id=\"x\" class=\"old\">A</div><div id=\"y\">B</div>",
    "<div id=\"y\">B</div><div id=\"x\" class=\"new\">A</div>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));

  bool has_move = false;
  bool has_attribute_change = false;
  for (size_t index = 0; index < herb_diff_operation_count(result); index++) {
    if (herb_diff_operation_at(result, index)->type == HERB_DIFF_NODE_MOVED) { has_move = true; }
    if (herb_diff_operation_at(result, index)->type == HERB_DIFF_ATTRIBUTE_VALUE_CHANGED) { has_attribute_change = true; }
  }

  ck_assert(has_move);
  ck_assert(has_attribute_change);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_multiple_changes_with_unchanged_subtree)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<div class=\"old\"><span>Hello</span><p>Keep</p></div>",
    "<div class=\"new\"><span>World</span><p>Keep</p></div>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 2);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_ATTRIBUTE_VALUE_CHANGED);
  ck_assert_uint_eq(herb_diff_operation_at(result, 1)->type, HERB_DIFF_TEXT_CHANGED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_node_wrapped)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div>Content</div>", "<% if condition? %><div>Content</div><% end %>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_NODE_WRAPPED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_node_unwrapped)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<% if condition? %><div>Content</div><% end %>", "<div>Content</div>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_NODE_UNWRAPPED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_node_wrapped_html)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div>Hello</div>", "<h1><div>Hello</div></h1>", &allocator);

  ck_assert(!herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 1);
  ck_assert_uint_eq(herb_diff_operation_at(result, 0)->type, HERB_DIFF_NODE_WRAPPED);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_operation_path)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div>Hello</div>", "<div>World</div>", &allocator);

  ck_assert_uint_eq(herb_diff_operation_count(result), 1);

  const herb_diff_operation_T* operation = herb_diff_operation_at(result, 0);
  ck_assert_uint_gt(operation->path.depth, 0);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_operation_nodes)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div>Hello</div>", "<div>World</div>", &allocator);

  const herb_diff_operation_T* operation = herb_diff_operation_at(result, 0);
  ck_assert_ptr_nonnull(operation->old_node);
  ck_assert_ptr_nonnull(operation->new_node);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_inserted_has_null_old_node)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div></div>", "<div><span>New</span></div>", &allocator);

  const herb_diff_operation_T* operation = herb_diff_operation_at(result, 0);
  ck_assert_ptr_null(operation->old_node);
  ck_assert_ptr_nonnull(operation->new_node);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_removed_has_null_new_node)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("<div><span>Old</span></div>", "<div></div>", &allocator);

  const herb_diff_operation_T* operation = herb_diff_operation_at(result, 0);
  ck_assert_ptr_nonnull(operation->old_node);
  ck_assert_ptr_null(operation->new_node);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_empty_documents)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources("", "", &allocator);

  ck_assert(herb_diff_trees_identical(result));
  ck_assert_uint_eq(herb_diff_operation_count(result), 0);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_multiple_moves)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<ul><li id=\"a\">A</li><li id=\"b\">B</li><li id=\"c\">C</li><li id=\"d\">D</li></ul>",
    "<ul><li id=\"d\">D</li><li id=\"c\">C</li><li id=\"b\">B</li><li id=\"a\">A</li></ul>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));

  size_t move_count = 0;
  for (size_t index = 0; index < herb_diff_operation_count(result); index++) {
    if (herb_diff_operation_at(result, index)->type == HERB_DIFF_NODE_MOVED) { move_count++; }
  }
  ck_assert_uint_ge(move_count, 2);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_move_preserves_indices)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<ul><li id=\"first\">1</li><li id=\"second\">2</li></ul>",
    "<ul><li id=\"second\">2</li><li id=\"first\">1</li></ul>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));

  for (size_t index = 0; index < herb_diff_operation_count(result); index++) {
    const herb_diff_operation_T* op = herb_diff_operation_at(result, index);
    if (op->type == HERB_DIFF_NODE_MOVED) {
      ck_assert_uint_ne(op->old_index, op->new_index);
    }
  }

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_move_among_insertions_and_removals)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<div id=\"keep\">Keep</div><div id=\"remove\">Remove</div>",
    "<div>New</div><div id=\"keep\">Keep</div>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));

  bool has_move = false;
  bool has_remove = false;
  bool has_insert = false;

  for (size_t index = 0; index < herb_diff_operation_count(result); index++) {
    herb_diff_operation_type_T type = herb_diff_operation_at(result, index)->type;
    if (type == HERB_DIFF_NODE_MOVED) { has_move = true; }
    if (type == HERB_DIFF_NODE_REMOVED) { has_remove = true; }
    if (type == HERB_DIFF_NODE_INSERTED) { has_insert = true; }
  }

  ck_assert(has_move);
  ck_assert(has_remove);
  ck_assert(has_insert);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_no_move_without_attributes)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<ul><li>A</li><li>B</li><li>C</li></ul>",
    "<ul><li>C</li><li>A</li><li>B</li></ul>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));

  for (size_t index = 0; index < herb_diff_operation_count(result); index++) {
    ck_assert_uint_ne(herb_diff_operation_at(result, index)->type, HERB_DIFF_NODE_MOVED);
  }

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_move_with_unchanged_middle)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  herb_diff_result_T* result = diff_sources(
    "<div id=\"a\">A</div><div id=\"static\">S</div><div id=\"b\">B</div>",
    "<div id=\"b\">B</div><div id=\"static\">S</div><div id=\"a\">A</div>",
    &allocator
  );

  ck_assert(!herb_diff_trees_identical(result));

  size_t move_count = 0;
  for (size_t index = 0; index < herb_diff_operation_count(result); index++) {
    if (herb_diff_operation_at(result, index)->type == HERB_DIFF_NODE_MOVED) { move_count++; }
  }
  ck_assert_uint_ge(move_count, 1);

  hb_allocator_destroy(&allocator);
END

TEST(test_diff_operation_type_to_string)
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_NODE_INSERTED), "node_inserted");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_NODE_REMOVED), "node_removed");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_NODE_REPLACED), "node_replaced");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_NODE_MOVED), "node_moved");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_TEXT_CHANGED), "text_changed");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_ERB_CONTENT_CHANGED), "erb_content_changed");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_ATTRIBUTE_ADDED), "attribute_added");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_ATTRIBUTE_REMOVED), "attribute_removed");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_ATTRIBUTE_VALUE_CHANGED), "attribute_value_changed");
  ck_assert_str_eq(herb_diff_operation_type_to_string(HERB_DIFF_TAG_NAME_CHANGED), "tag_name_changed");
END

TCase *diff_tests(void) {
  TCase *diff = tcase_create("Diff");

  tcase_add_test(diff, test_diff_identical_documents);
  tcase_add_test(diff, test_diff_text_changed);
  tcase_add_test(diff, test_diff_attribute_value_changed);
  tcase_add_test(diff, test_diff_attribute_added);
  tcase_add_test(diff, test_diff_attribute_removed);
  tcase_add_test(diff, test_diff_node_inserted);
  tcase_add_test(diff, test_diff_node_removed);
  tcase_add_test(diff, test_diff_erb_content_changed);
  tcase_add_test(diff, test_diff_node_moved_with_attributes);
  tcase_add_test(diff, test_diff_plain_reorder_no_move);
  tcase_add_test(diff, test_diff_move_with_attribute_change);
  tcase_add_test(diff, test_diff_multiple_changes_with_unchanged_subtree);
  tcase_add_test(diff, test_diff_node_wrapped);
  tcase_add_test(diff, test_diff_node_unwrapped);
  tcase_add_test(diff, test_diff_node_wrapped_html);
  tcase_add_test(diff, test_diff_operation_path);
  tcase_add_test(diff, test_diff_operation_nodes);
  tcase_add_test(diff, test_diff_inserted_has_null_old_node);
  tcase_add_test(diff, test_diff_removed_has_null_new_node);
  tcase_add_test(diff, test_diff_empty_documents);
  tcase_add_test(diff, test_diff_multiple_moves);
  tcase_add_test(diff, test_diff_move_preserves_indices);
  tcase_add_test(diff, test_diff_move_among_insertions_and_removals);
  tcase_add_test(diff, test_diff_no_move_without_attributes);
  tcase_add_test(diff, test_diff_move_with_unchanged_middle);
  tcase_add_test(diff, test_diff_operation_type_to_string);

  return diff;
}

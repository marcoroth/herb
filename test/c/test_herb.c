#include "include/test.h"
#include "../../src/include/herb.h"
#include "../../src/include/lib/hb_allocator.h"

TEST(test_herb_version)
  ck_assert_str_eq(herb_version(), "0.10.3");
END

TEST(test_herb_frees_an_error_with_an_empty_string_field)
  parser_options_T options = HERB_DEFAULT_PARSER_OPTIONS;
  options.strict_locals = true;

  hb_allocator_T allocator = hb_allocator_with_malloc();

  AST_DOCUMENT_NODE_T* document = herb_parse("<%# locals: %>", &options, &allocator);

  ck_assert_ptr_nonnull(document);

  ast_node_free((AST_NODE_T*) document, &allocator);
  hb_allocator_destroy(&allocator);
END

TCase *herb_tests(void) {
  TCase *herb = tcase_create("Herb");

  tcase_add_test(herb, test_herb_version);
  tcase_add_test(herb, test_herb_frees_an_error_with_an_empty_string_field);

  return herb;
}

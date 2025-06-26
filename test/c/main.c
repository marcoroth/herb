#include <check.h>
#include <stdlib.h>

TCase *analyze_tag_helpers_tests(void);
TCase *array_tests(void);
TCase *buffer_tests(void);
TCase *herb_tests(void);
TCase *html_util_tests(void);
TCase *io_tests(void);
TCase *json_tests(void);
TCase *lex_tests(void);
TCase *token_tests(void);
TCase *util_tests(void);
TCase *content_tag_handler_tests(void);
TCase *tag_handler_tests(void);
TCase *keyword_arguments_tests(void);
TCase *tag_helper_registry_tests(void);
TCase *modular_tag_helpers_tests(void);
TCase *link_to_handler_tests(void);
TCase *attribute_extraction_helpers_tests(void);

Suite *herb_suite(void) {
  Suite *suite = suite_create("Herb Suite");

  suite_add_tcase(suite, analyze_tag_helpers_tests());
  suite_add_tcase(suite, array_tests());
  suite_add_tcase(suite, buffer_tests());
  suite_add_tcase(suite, herb_tests());
  suite_add_tcase(suite, html_util_tests());
  suite_add_tcase(suite, io_tests());
  suite_add_tcase(suite, json_tests());
  suite_add_tcase(suite, lex_tests());
  suite_add_tcase(suite, token_tests());
  suite_add_tcase(suite, util_tests());
  suite_add_tcase(suite, content_tag_handler_tests());
  suite_add_tcase(suite, tag_handler_tests());
  suite_add_tcase(suite, keyword_arguments_tests());
  suite_add_tcase(suite, tag_helper_registry_tests());
  suite_add_tcase(suite, modular_tag_helpers_tests());
  suite_add_tcase(suite, link_to_handler_tests());
  suite_add_tcase(suite, attribute_extraction_helpers_tests());

  return suite;
}

int main(void) {
  Suite *suite = herb_suite();
  SRunner *runner = srunner_create(suite);

  srunner_run_all(runner, CK_NORMAL);
  const int number_failed = srunner_ntests_failed(runner);
  srunner_free(runner);

  return (number_failed == 0 ? EXIT_SUCCESS : EXIT_FAILURE);
}

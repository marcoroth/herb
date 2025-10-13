#include <check.h>
#include <stdlib.h>

TCase *hb_arena_tests(void);
TCase *hb_array_tests(void);
TCase *hb_buffer_tests(void);
TCase *hb_string_tests(void);
TCase *herb_tests(void);
TCase *html_util_tests(void);
TCase *io_tests(void);
TCase *lex_tests(void);
TCase *token_tests(void);
TCase *util_tests(void);

Suite *herb_suite(void) {
  Suite *suite = suite_create("Herb Suite");

  suite_add_tcase(suite, hb_arena_tests());
  suite_add_tcase(suite, hb_array_tests());
  suite_add_tcase(suite, hb_buffer_tests());
  suite_add_tcase(suite, hb_string_tests());
  suite_add_tcase(suite, herb_tests());
  suite_add_tcase(suite, html_util_tests());
  suite_add_tcase(suite, io_tests());
  suite_add_tcase(suite, lex_tests());
  suite_add_tcase(suite, token_tests());
  suite_add_tcase(suite, util_tests());

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

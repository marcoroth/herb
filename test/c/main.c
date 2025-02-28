#include <check.h>
#include <stdlib.h>

TCase *array_tests(void);
TCase *buffer_tests(void);
TCase *erbx_tests(void);
TCase *io_tests(void);
TCase *json_tests(void);
TCase *tags_tests(void);
TCase *token_tests(void);

Suite *erbx_suite(void) {
  Suite *suite = suite_create("ERBX Suite");

  suite_add_tcase(suite, array_tests());
  suite_add_tcase(suite, buffer_tests());
  suite_add_tcase(suite, erbx_tests());
  suite_add_tcase(suite, io_tests());
  suite_add_tcase(suite, json_tests());
  // suite_add_tcase(suite, tags_tests());
  suite_add_tcase(suite, token_tests());

  return suite;
}

int main(void) {
  Suite *suite = erbx_suite();
  SRunner *runner = srunner_create(suite);

  srunner_run_all(runner, CK_NORMAL);
  const int number_failed = srunner_ntests_failed(runner);
  srunner_free(runner);

  return (number_failed == 0 ? EXIT_SUCCESS : EXIT_FAILURE);
}

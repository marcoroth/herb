#include <check.h>
#include <stdlib.h>

TCase *tags_tests(void);
TCase *token_tests(void);
TCase *erbx_tests(void);

Suite *erbx_suite(void) {
  Suite *suite = suite_create("ERBX Suite");

  // suite_add_tcase(suite, token_tests());
  // suite_add_tcase(suite, tags_tests());
  // suite_add_tcase(suite, erbx_tests());

  return suite;
}

int main(void) {
  int number_failed;
  Suite *suite = erbx_suite();
  SRunner *runner = srunner_create(suite);

  srunner_run_all(runner, CK_NORMAL);
  number_failed = srunner_ntests_failed(runner);
  srunner_free(runner);

  return (number_failed == 0 ? EXIT_SUCCESS : EXIT_FAILURE);
}

#include <check.h>
#include <stdlib.h>

Suite *erbx_suite(void);

int main(void) {
  int number_failed;
  Suite *suite = erbx_suite();
  SRunner *runner = srunner_create(suite);

  srunner_run_all(runner, CK_NORMAL);
  number_failed = srunner_ntests_failed(runner);
  srunner_free(runner);

  return (number_failed == 0 ? EXIT_SUCCESS : EXIT_FAILURE);
}

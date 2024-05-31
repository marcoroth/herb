#include "include/test.h"

#include "../src/include/token.h"

TEST(test)
  ck_assert_str_eq(token_type_to_string(TOKEN_ATTRIBUTE_NAME), "TOKEN_ATTRIBUTE_NAME");
END

Suite *erbx_suite(void) {
  Suite *suite = suite_create("ERBX Suite");
  TCase *tcase = tcase_create("Core");

  tcase_add_test(tcase, test);
  suite_add_tcase(suite, tcase);

  return suite;
}

#include <stdio.h>
#include "include/test.h"
#include "../../src/include/herb.h"
#include "../../src/include/util.h"

TEST(util_is_newline)
  ck_assert_int_eq(is_newline('\n'), 1);
  ck_assert_int_eq(is_newline('\r'), 1);

  ck_assert_int_eq(is_newline(' '), 0);
  ck_assert_int_eq(is_newline('a'), 0);
END


TCase *util_tests(void) {
  TCase *util = tcase_create("Util");

  tcase_add_test(util, util_is_newline);
  tcase_add_test(util, util_replace_char_returns_original);

  return util;
}

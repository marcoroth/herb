#include <stdio.h>
#include "include/test.h"
#include "../../src/include/herb.h"
#include "../../src/include/util.h"

TEST(util_count_newlines)
  ck_assert_int_eq(count_newlines("\n"), 1);
  ck_assert_int_eq(count_newlines("\n\n"), 2);

  ck_assert_int_eq(count_newlines("\r"), 1);
  ck_assert_int_eq(count_newlines("\r\r"), 2);

  ck_assert_int_eq(count_newlines("\r\n"), 1);
  ck_assert_int_eq(count_newlines("\r\n\r\n"), 2);
END

TEST(util_is_newline)
  ck_assert_int_eq(is_newline('\n'), 1);
  ck_assert_int_eq(is_newline('\r'), 1);

  ck_assert_int_eq(is_newline(' '), 0);
  ck_assert_int_eq(is_newline('a'), 0);
END

TEST(util_replace_char_returns_original)
  char str[] = "abca";
  char *returned = replace_char(str, 'a', 'x');

  ck_assert_ptr_eq(returned, str);
  ck_assert_str_eq(str, "xbcx");
END

TCase *util_tests(void) {
  TCase *util = tcase_create("Util");

  tcase_add_test(util, util_count_newlines);
  tcase_add_test(util, util_is_newline);
  tcase_add_test(util, util_replace_char_returns_original);

  return util;
}

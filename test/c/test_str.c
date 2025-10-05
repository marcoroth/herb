#include "include/test.h"
#include "../../src/include/str.h"
#include <string.h>

TEST(str_equals_tests)
  {
    str_T a = str_from_c_string("Hello, world.");
    str_T b = str_from_c_string("Hello, world.");

    ck_assert(str_equals(a, b));
  }

  {
    str_T a = str_from_c_string("Hello, world.");
    str_T b = str_from_c_string("Hello, world. Longer text");

    ck_assert(!str_equals(a, b));
  }

  {
    str_T a = str_from_c_string("Hello, world.");
    str_T b = str_from_c_string("");

    ck_assert(!str_equals(a, b));
  }
END

TEST(str_equals_case_insensitive_tests)
  {
    str_T a = str_from_c_string("Hello, world.");
    str_T b = str_from_c_string("Hello, World. Really?");

    ck_assert(!str_equals_case_insensitive(a, b));
  }

  {
    str_T a = str_from_c_string("Hello, world.");
    str_T b = str_from_c_string("Hello, World.");

    ck_assert(str_equals_case_insensitive(a, b));
  }

  {
    str_T a = str_from_c_string("This.");
    str_T b = str_from_c_string("That.");

    ck_assert(!str_equals_case_insensitive(a, b));
  }
END

TEST(str_is_empty_tests)
  {
    str_T str = {
      .length = 0,
      .data = NULL
    };

    ck_assert(str_is_empty(str));
  }

  {
    str_T str = str_from_c_string("");

    ck_assert(str_is_empty(str));
  }

  {
    str_T str = str_from_c_string("Content");

    ck_assert(!str_is_empty(str));
  }
END

TEST(str_start_with_tests)
  {
    str_T str = str_from_c_string("This.");
    str_T prefix = {
      .length = 0,
      .data = NULL,
    };

    ck_assert(!str_start_with(str, prefix));
  }

  {
    str_T str = {
      .length = 0,
      .data = NULL,
    };
    str_T prefix = str_from_c_string("This.");

    ck_assert(!str_start_with(str, prefix));
  }

  {
    str_T str = {
      .length = 0,
      .data = NULL,
    };
    str_T prefix = str_from_c_string("This.");

    ck_assert(!str_start_with(str, prefix));
  }

  {
    str_T str = str_from_c_string("Long text.");
    str_T prefix = str_from_c_string("Long text.");

    ck_assert(str_start_with(str, prefix));
  }

  {
    str_T str = str_from_c_string("Long text.");
    str_T prefix = str_from_c_string("Long");

    ck_assert(str_start_with(str, prefix));
  }

  {
    str_T str = str_from_c_string("Long text.");
    str_T prefix = str_from_c_string("No");

    ck_assert(!str_start_with(str, prefix));
  }

  {
    str_T str = str_from_c_string("Long text.");
    str_T prefix = str_from_c_string("This prefix is longer than the text");

    ck_assert(!str_start_with(str, prefix));
  }
END

TCase *str_tests(void) {
  TCase *tags = tcase_create("Str");

  tcase_add_test(tags, str_equals_tests);
  tcase_add_test(tags, str_equals_case_insensitive_tests);
  tcase_add_test(tags, str_is_empty_tests);
  tcase_add_test(tags, str_start_with_tests);

  return tags;
}

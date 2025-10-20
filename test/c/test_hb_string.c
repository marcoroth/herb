#include "include/test.h"
#include "../../src/include/util/hb_string.h"
#include <string.h>

TEST(hb_string_equals_tests)
  {
    hb_string_T a = hb_string("Hello, world.");
    hb_string_T b = hb_string("Hello, world.");

    ck_assert(hb_string_equals(a, b));
  }

  {
    hb_string_T a = hb_string("Hello, world.");
    hb_string_T b = hb_string("Hello, world. Longer text");

    ck_assert(!hb_string_equals(a, b));
  }

  {
    hb_string_T a = hb_string("Hello, world.");
    hb_string_T b = hb_string("");

    ck_assert(!hb_string_equals(a, b));
  }
END

TEST(hb_string_offset_based_slice_tests)
  {
    hb_string_T source = hb_string("01234");
    hb_string_T expected_slice = hb_string("234");

    hb_string_T slice = hb_string_slice(source, 2);

    ck_assert(hb_string_equals(slice, expected_slice));
  }

  {
    hb_string_T source = hb_string("01234");
    hb_string_T expected_slice = hb_string("4");

    hb_string_T slice = hb_string_slice(source, 4);

    ck_assert(hb_string_equals(slice, expected_slice));
  }

  {
    hb_string_T source = hb_string("01234");
    hb_string_T slice = hb_string_slice(source, 5);

    ck_assert(hb_string_is_empty(slice));
  }

  {
    hb_string_T source = hb_string("01234");
    hb_string_T slice = hb_string_slice(source, 6);

    ck_assert(hb_string_is_empty(slice));
  }
END


TEST(hb_string_equals_case_insensitive_tests)
  {
    hb_string_T a = hb_string("Hello, world.");
    hb_string_T b = hb_string("Hello, World. Really?");

    ck_assert(!hb_string_equals_case_insensitive(a, b));
  }

  {
    hb_string_T a = hb_string("Hello, world.");
    hb_string_T b = hb_string("Hello, World.");

    ck_assert(hb_string_equals_case_insensitive(a, b));
  }

  {
    hb_string_T a = hb_string("This.");
    hb_string_T b = hb_string("That.");

    ck_assert(!hb_string_equals_case_insensitive(a, b));
  }
END

TEST(hb_string_is_empty_tests)
  {
    hb_string_T str = {
      .length = 0,
      .data = NULL
    };

    ck_assert(hb_string_is_empty(str));
  }

  {
    hb_string_T str = hb_string("");

    ck_assert(hb_string_is_empty(str));
  }

  {
    hb_string_T str = hb_string("Content");

    ck_assert(!hb_string_is_empty(str));
  }
END

TEST(hb_string_starts_with_tests)
  {
    hb_string_T str = hb_string("This.");
    hb_string_T prefix = {
      .length = 0,
      .data = NULL,
    };

    ck_assert(!hb_string_starts_with(str, prefix));
  }

  {
    hb_string_T str = {
      .length = 0,
      .data = NULL,
    };
    hb_string_T prefix = hb_string("This.");

    ck_assert(!hb_string_starts_with(str, prefix));
  }

  {
    hb_string_T str = hb_string("Long text.");
    hb_string_T prefix = hb_string("Long text.");

    ck_assert(hb_string_starts_with(str, prefix));
  }

  {
    hb_string_T str = hb_string("Long text.");
    hb_string_T prefix = hb_string("Long");

    ck_assert(hb_string_starts_with(str, prefix));
  }

  {
    hb_string_T str = hb_string("Long text.");
    hb_string_T prefix = hb_string("No");

    ck_assert(!hb_string_starts_with(str, prefix));
  }

  {
    hb_string_T str = hb_string("Long text.");
    hb_string_T prefix = hb_string("This prefix is longer than the text");

    ck_assert(!hb_string_starts_with(str, prefix));
  }
END

TCase *hb_string_tests(void) {
  TCase *tags = tcase_create("Herb String");

  tcase_add_test(tags, hb_string_equals_tests);
  tcase_add_test(tags, hb_string_offset_based_slice_tests);
  tcase_add_test(tags, hb_string_equals_case_insensitive_tests);
  tcase_add_test(tags, hb_string_is_empty_tests);
  tcase_add_test(tags, hb_string_starts_with_tests);

  return tags;
}

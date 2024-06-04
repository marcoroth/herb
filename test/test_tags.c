#include "include/test.h"
#include "../src/include/erbx.h"

TEST(test_basic_tag)
  char* html = "";
  buffer output;

  erbx_compile(html, &output);

  buffer_free(&output);
END

TCase *tags_tests(void) {
  TCase *tags = tcase_create("Tags");

  tcase_add_test(tags, test_basic_tag);

  return tags;
}

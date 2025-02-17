#include "include/test.h"
#include "../../src/include/erbx.h"

TEST(test_erbx_version)
  ck_assert_str_eq(erbx_version(), "0.0.1");
END

TCase *erbx_tests(void) {
  TCase *erbx = tcase_create("ERBX");

  tcase_add_test(erbx, test_erbx_version);

  return erbx;
}

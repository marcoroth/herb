#include "include/test.h"
#include "../../src/include/herb.h"

TEST(test_herb_version)
  ck_assert_str_eq(herb_version(), "0.6.1");
END

TCase *herb_tests(void) {
  TCase *herb = tcase_create("Herb");

  tcase_add_test(herb, test_herb_version);

  return herb;
}

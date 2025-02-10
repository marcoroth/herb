#include "../src/include/token.h"
#include "include/test.h"

TEST(test_token)
ck_assert_str_eq(token_type_string(TOKEN_ATTRIBUTE_NAME), "TOKEN_ATTRIBUTE_NAME");
END

    TCase *
    token_tests(void) {
  TCase *token = tcase_create("Token");

  tcase_add_test(token, test_token);

  return token;
}

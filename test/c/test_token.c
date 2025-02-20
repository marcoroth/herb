#include <stdio.h>
#include "include/test.h"
#include "../../src/include/erbx.h"
#include "../../src/include/token.h"

TEST(test_token)
  ck_assert_str_eq(token_type_to_string(TOKEN_IDENTIFIER), "TOKEN_IDENTIFIER");
END

TEST(test_token_to_string)
  buffer_T output = buffer_new();
  erbx_lex_to_buffer("hello", &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_IDENTIFIER value='hello' range=[0, 5] start=1:0 end=1:5>\n"
    "#<Token type=TOKEN_EOF value='' range=[5, 5] start=1:5 end=1:5>\n"
  );

  buffer_free(&output);
END

TEST(test_token_to_json)
  buffer_T output = buffer_new();
  erbx_lex_json_to_buffer("hello", &output);

  char* expected = "["
  "{\"type\": \"TOKEN_IDENTIFIER\", \"value\": \"hello\", \"range\": [0 , 5], \"start\": {\"line\": 1, \"column\": 0}, \"end\": {\"line\": 1, \"column\": 0}}, "
  "{\"type\": \"TOKEN_EOF\", \"value\": \"\", \"range\": [5 , 5], \"start\": {\"line\": 1, \"column\": 5}, \"end\": {\"line\": 1, \"column\": 5}}"
  "]";

  ck_assert_str_eq(output.value, expected);

  buffer_free(&output);
END

TCase *token_tests(void) {
  TCase *token = tcase_create("Token");

  tcase_add_test(token, test_token);
  tcase_add_test(token, test_token_to_string);
  tcase_add_test(token, test_token_to_json);

  return token;
}

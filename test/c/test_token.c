#include <stdio.h>
#include "include/test.h"
#include "../../src/include/herb.h"
#include "../../src/include/token.h"

TEST(test_token)
  ck_assert(hb_string_equals(token_type_to_string(TOKEN_IDENTIFIER), hb_string("TOKEN_IDENTIFIER")));
END

TEST(test_token_to_string)
  hb_buffer_T output;
  hb_buffer_init(&output, 1024);
  herb_lex_to_buffer("hello", &output);

  ck_assert_str_eq(
    output.value,
    "#<Herb::Token type=\"TOKEN_IDENTIFIER\" value=\"hello\" range=[0, 5] start=(1:0) end=(1:5)>\n"
    "#<Herb::Token type=\"TOKEN_EOF\" value=\"<EOF>\" range=[5, 5] start=(1:5) end=(1:5)>\n"
  );

  free(output.value);
END

TCase *token_tests(void) {
  TCase *token = tcase_create("Token");

  tcase_add_test(token, test_token);
  tcase_add_test(token, test_token_to_string);

  return token;
}

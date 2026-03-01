#include <stdio.h>
#include "include/test.h"
#include "../../src/include/herb.h"
#include "../../src/include/token.h"

TEST(test_token)
  ck_assert_str_eq(token_type_to_string(TOKEN_IDENTIFIER), "TOKEN_IDENTIFIER");
END

TEST(test_token_type_to_friendly_string)
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_IDENTIFIER), "an identifier");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_WHITESPACE), "whitespace");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_NEWLINE), "a newline");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_QUOTE), "a quote");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_CHARACTER), "a character");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_EOF), "end of file");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_TAG_START), "`<`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_TAG_END), "`>`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_TAG_SELF_CLOSE), "`/>`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_TAG_START_CLOSE), "`</`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_COMMENT_START), "`<!--`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_COMMENT_END), "`-->`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_EQUALS), "`=`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_SLASH), "`/`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_COLON), "`:`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_ERB_START), "`<%`");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_ERB_END), "`%>`");
END

TEST(test_token_types_to_friendly_string)
  char* result1 = token_types_to_friendly_string(TOKEN_IDENTIFIER);
  ck_assert_str_eq(result1, "an identifier");
  free(result1);

  char* result2 = token_types_to_friendly_string(TOKEN_IDENTIFIER, TOKEN_QUOTE);
  ck_assert_str_eq(result2, "an identifier or a quote");
  free(result2);

  char* result3 = token_types_to_friendly_string(TOKEN_IDENTIFIER, TOKEN_QUOTE, TOKEN_ERB_START);
  ck_assert_str_eq(result3, "an identifier, a quote, or `<%`");
  free(result3);

  char* result4 = token_types_to_friendly_string(TOKEN_IDENTIFIER, TOKEN_ERB_START, TOKEN_WHITESPACE, TOKEN_NEWLINE);
  ck_assert_str_eq(result4, "an identifier, `<%`, whitespace, or a newline");
  free(result4);

  char* result5 = token_types_to_friendly_string(TOKEN_HTML_TAG_START, TOKEN_HTML_TAG_END, TOKEN_EQUALS);
  ck_assert_str_eq(result5, "`<`, `>`, or `=`");
  free(result5);
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
  tcase_add_test(token, test_token_type_to_friendly_string);
  tcase_add_test(token, test_token_types_to_friendly_string);
  tcase_add_test(token, test_token_to_string);

  return token;
}

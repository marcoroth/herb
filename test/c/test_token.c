#include <stdio.h>
#include "include/test.h"
#include "../../src/include/herb.h"
#include "../../src/include/lex_helpers.h"
#include "../../src/include/token.h"
#include "../../src/include/util/hb_allocator.h"
#include "../../src/include/util/hb_string.h"

TEST(test_token)
  ck_assert(hb_string_equals(token_type_to_string(TOKEN_IDENTIFIER), hb_string("TOKEN_IDENTIFIER")));
END

TEST(test_token_type_to_friendly_string)
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_IDENTIFIER), hb_string("an identifier")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_WHITESPACE), hb_string("whitespace")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_NEWLINE), hb_string("a newline")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_QUOTE), hb_string("a quote")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_CHARACTER), hb_string("a character")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_EOF), hb_string("end of file")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_HTML_TAG_START), hb_string("`<`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_HTML_TAG_END), hb_string("`>`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_HTML_TAG_SELF_CLOSE), hb_string("`/>`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_HTML_TAG_START_CLOSE), hb_string("`</`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_HTML_COMMENT_START), hb_string("`<!--`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_HTML_COMMENT_END), hb_string("`-->`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_EQUALS), hb_string("`=`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_SLASH), hb_string("`/`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_COLON), hb_string("`:`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_ERB_START), hb_string("`<%`")));
  ck_assert(hb_string_equals(token_type_to_friendly_string(TOKEN_ERB_END), hb_string("`%>`")));
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
  hb_allocator_T allocator = hb_allocator_with_malloc();
  herb_lex_to_buffer("hello", &output, &allocator);

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

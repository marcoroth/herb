#include <stdio.h>
#include "include/test.h"
#include "../../src/include/herb.h"
#include "../../src/include/token.h"

TEST(test_token)
  ck_assert_str_eq(token_type_to_string(TOKEN_IDENTIFIER), "TOKEN_IDENTIFIER");
END

TEST(test_token_type_to_friendly_string)
  // Test regular tokens
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_IDENTIFIER), "identifier");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_WHITESPACE), "whitespace");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_NEWLINE), "newline");
  
  // Test HTML tokens with actual characters
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_TAG_START), "<");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_TAG_END), ">");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_TAG_SELF_CLOSE), "/>");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_COMMENT_START), "<!--");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_HTML_COMMENT_END), "-->");
  
  // Test single character tokens
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_EQUALS), "=");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_SLASH), "/");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_COLON), ":");
  
  // Test ERB tokens
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_ERB_START), "ERB start");
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_ERB_END), "ERB end");
  
  // Test special tokens
  ck_assert_str_eq(token_type_to_friendly_string(TOKEN_EOF), "end of file");
END

TEST(test_token_types_to_friendly_string)
  // Test single token
  char* result1 = token_types_to_friendly_string(TOKEN_IDENTIFIER);
  ck_assert_str_eq(result1, "`identifier`");
  free(result1);
  
  // Test two tokens
  char* result2 = token_types_to_friendly_string(TOKEN_IDENTIFIER, TOKEN_QUOTE);
  ck_assert_str_eq(result2, "`identifier` or `quote`");
  free(result2);
  
  // Test three tokens
  char* result3 = token_types_to_friendly_string(TOKEN_IDENTIFIER, TOKEN_QUOTE, TOKEN_ERB_START);
  ck_assert_str_eq(result3, "`identifier`, `quote` or `ERB start`");
  free(result3);
  
  // Test four tokens
  char* result4 = token_types_to_friendly_string(TOKEN_IDENTIFIER, TOKEN_ERB_START, TOKEN_WHITESPACE, TOKEN_NEWLINE);
  ck_assert_str_eq(result4, "`identifier`, `ERB start`, `whitespace` or `newline`");
  free(result4);
  
  // Test with HTML tokens showing actual characters
  char* result5 = token_types_to_friendly_string(TOKEN_HTML_TAG_START, TOKEN_HTML_TAG_END, TOKEN_EQUALS);
  ck_assert_str_eq(result5, "`<`, `>` or `=`");
  free(result5);
END

TEST(test_token_to_string)
  buffer_T output = buffer_new();
  herb_lex_to_buffer("hello", &output);

  ck_assert_str_eq(
    output.value,
    "#<Herb::Token type=\"TOKEN_IDENTIFIER\" value=\"hello\" range=[0, 5] start=(1:0) end=(1:5)>\n"
    "#<Herb::Token type=\"TOKEN_EOF\" value=\"<EOF>\" range=[5, 5] start=(1:5) end=(1:5)>\n"
  );

  buffer_free(&output);
END

TEST(test_token_to_json)
  buffer_T output = buffer_new();
  herb_lex_json_to_buffer("hello", &output);

  const char* expected = "["
  "{\"type\": \"TOKEN_IDENTIFIER\", \"value\": \"hello\", \"range\": [0 , 5], \"start\": {\"line\": 1, \"column\": 0}, \"end\": {\"line\": 1, \"column\": 5}}, "
  "{\"type\": \"TOKEN_EOF\", \"value\": \"\", \"range\": [5 , 5], \"start\": {\"line\": 1, \"column\": 5}, \"end\": {\"line\": 1, \"column\": 5}}"
  "]";

  ck_assert_str_eq(output.value, expected);

  buffer_free(&output);
END

TCase *token_tests(void) {
  TCase *token = tcase_create("Token");

  tcase_add_test(token, test_token);
  tcase_add_test(token, test_token_type_to_friendly_string);
  tcase_add_test(token, test_token_types_to_friendly_string);
  tcase_add_test(token, test_token_to_string);
  tcase_add_test(token, test_token_to_json);

  return token;
}

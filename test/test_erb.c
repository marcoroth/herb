#include "include/test.h"
#include "../src/include/erbx.h"

TEST(test_erb_silent)
  char* html = "<% 'hello world' %>";
  buffer_T output;

  buffer_init(&output);

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(output.value,
      "#<Token type=TOKEN_ERB_SILENT_OPEN value='<%' range=[0, 2] start=1:0 end=1:2>\n"
      "#<Token type=TOKEN_ERB_RUBY value=' 'hello world' ' range=[2, 17] start=1:2 end=1:17>\n"
      "#<Token type=TOKEN_ERB_CLOSE value='%>' range=[17, 19] start=1:17 end=1:19>\n"
      "#<Token type=TOKEN_EOF value='' range=[19, 19] start=1:19 end=1:19>\n");

  buffer_free(&output);
END

TCase *erb_tests(void) {
  TCase *erb = tcase_create("ERB");

  tcase_add_test(erb, test_erb_silent);

  return erb;
}

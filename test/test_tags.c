#include "include/test.h"
#include "../src/include/erbx.h"

TEST(test_empty_file)
  char* html = "";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(output.value, "<type='TOKEN_EOF', int_type='5', value=''>\n");

  buffer_free(&output);
END

TEST(test_basic_tag)
  char* html = "<html></html>";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='html'>\n"
    "<type='TOKEN_START_TAG_END', int_type='12', value='>'>\n"
    "<type='TOKEN_END_TAG_START', int_type='4', value='</'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='html'>\n"
    "<type='TOKEN_END_TAG_END', int_type='3', value='>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

TEST(test_basic_void_tag)
  char* html = "<img />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='img'>\n"
    "<type='TOKEN_START_TAG_END_VOID', int_type='11', value='/>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

TEST(test_namespaced_tag)
  char* html = "<ns:table></ns:table>";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='ns:table'>\n"
    "<type='TOKEN_START_TAG_END', int_type='12', value='>'>\n"
    "<type='TOKEN_END_TAG_START', int_type='4', value='</'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='ns:table'>\n"
    "<type='TOKEN_END_TAG_END', int_type='3', value='>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

TEST(test_text_content)
  char* html = "<h1>Hello World</h1>";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='h1'>\n"
    "<type='TOKEN_START_TAG_END', int_type='12', value='>'>\n"
    "<type='TOKEN_TEXT_CONTENT', int_type='16', value='Hello World'>\n"
    "<type='TOKEN_END_TAG_START', int_type='4', value='</'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='h1'>\n"
    "<type='TOKEN_END_TAG_END', int_type='3', value='>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

TEST(test_attribute_value_double_quotes)
  char* html = "<img value=\"hello world\" />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='img'>\n"
    "<type='TOKEN_ATTRIBUTE_NAME', int_type='0', value='value'>\n"
    "<type='TOKEN_EQUALS', int_type='6', value='='>\n"
    "<type='TOKEN_DOUBLE_QUOTE', int_type='2', value='\"'>\n"
    "<type='TOKEN_ATTRIBUTE_VALUE', int_type='1', value='hello world'>\n"
    "<type='TOKEN_DOUBLE_QUOTE', int_type='2', value='\"'>\n"
    "<type='TOKEN_START_TAG_END_VOID', int_type='11', value='/>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

TEST(test_attribute_value_single_quotes)
  char* html = "<img value='hello world' />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='img'>\n"
    "<type='TOKEN_ATTRIBUTE_NAME', int_type='0', value='value'>\n"
    "<type='TOKEN_EQUALS', int_type='6', value='='>\n"
    "<type='TOKEN_SINGLE_QUOTE', int_type='9', value='''>\n"
    "<type='TOKEN_ATTRIBUTE_VALUE', int_type='1', value='hello world'>\n"
    "<type='TOKEN_SINGLE_QUOTE', int_type='9', value='''>\n"
    "<type='TOKEN_START_TAG_END_VOID', int_type='11', value='/>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

// TEST(test_attribute_value_no_quotes)
//   char* html = "<img value=hello />";
//   buffer_T output;
//
//   erbx_lex_to_buffer(html, &output);
//
//   ck_assert_str_eq(
//     output.value,
//     "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
//     "<type='TOKEN_TAG_NAME', int_type='15', value='img'>\n"
//     "<type='TOKEN_ATTRIBUTE_NAME', int_type='0', value='value'>\n"
//     "<type='TOKEN_EQUALS', int_type='6', value='='>\n"
//     "<type='TOKEN_ATTRIBUTE_VALUE', int_type='1', value='hello'>\n"
//     "<type='TOKEN_START_TAG_END_VOID', int_type='11', value='/>'>\n"
//     "<type='TOKEN_EOF', int_type='5', value=''>\n"
//   );
//
//   buffer_free(&output);
// END

TEST(test_attribute_value_empty_double_quotes)
  char* html = "<img value=\"\" />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='img'>\n"
    "<type='TOKEN_ATTRIBUTE_NAME', int_type='0', value='value'>\n"
    "<type='TOKEN_EQUALS', int_type='6', value='='>\n"
    "<type='TOKEN_DOUBLE_QUOTE', int_type='2', value='\"'>\n"
    "<type='TOKEN_ATTRIBUTE_VALUE', int_type='1', value=''>\n"
    "<type='TOKEN_DOUBLE_QUOTE', int_type='2', value='\"'>\n"
    "<type='TOKEN_START_TAG_END_VOID', int_type='11', value='/>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

TEST(test_attribute_value_empty_single_quotes)
  char* html = "<img value='' />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='img'>\n"
    "<type='TOKEN_ATTRIBUTE_NAME', int_type='0', value='value'>\n"
    "<type='TOKEN_EQUALS', int_type='6', value='='>\n"
    "<type='TOKEN_SINGLE_QUOTE', int_type='9', value='''>\n"
    "<type='TOKEN_ATTRIBUTE_VALUE', int_type='1', value=''>\n"
    "<type='TOKEN_SINGLE_QUOTE', int_type='9', value='''>\n"
    "<type='TOKEN_START_TAG_END_VOID', int_type='11', value='/>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

TEST(test_boolean_attribute)
  char* html = "<img required />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "<type='TOKEN_START_TAG_START', int_type='13', value='<'>\n"
    "<type='TOKEN_TAG_NAME', int_type='15', value='img'>\n"
    "<type='TOKEN_ATTRIBUTE_NAME', int_type='0', value='required'>\n"
    "<type='TOKEN_START_TAG_END_VOID', int_type='11', value='/>'>\n"
    "<type='TOKEN_EOF', int_type='5', value=''>\n"
  );

  buffer_free(&output);
END

TCase *tags_tests(void) {
  TCase *tags = tcase_create("Tags");

  tcase_add_test(tags, test_empty_file);
  tcase_add_test(tags, test_basic_tag);
  tcase_add_test(tags, test_basic_void_tag);
  tcase_add_test(tags, test_namespaced_tag);
  tcase_add_test(tags, test_text_content);
  tcase_add_test(tags, test_attribute_value_double_quotes);
  tcase_add_test(tags, test_attribute_value_single_quotes);
  // tcase_add_test(tags, test_attribute_value_no_quotes);
  tcase_add_test(tags, test_attribute_value_empty_double_quotes);
  tcase_add_test(tags, test_attribute_value_empty_single_quotes);
  tcase_add_test(tags, test_boolean_attribute);


  return tags;
}

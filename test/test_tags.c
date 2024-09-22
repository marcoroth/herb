#include "include/test.h"
#include "../src/include/erbx.h"

TEST(test_empty_file)
  char* html = "";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(output.value, "#<Token type=TOKEN_EOF value='' range=[0, 0] start=1:0 end=1:0>\n");

  buffer_free(&output);
END

TEST(test_basic_tag)
  char* html = "<html></html>";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='html' range=[1, 5] start=1:1 end=1:5>\n"
    "#<Token type=TOKEN_START_TAG_END value='>' range=[5, 6] start=1:5 end=1:6>\n"
    "#<Token type=TOKEN_END_TAG_START value='</' range=[6, 8] start=1:6 end=1:8>\n"
    "#<Token type=TOKEN_TAG_NAME value='html' range=[8, 12] start=1:8 end=1:12>\n"
    "#<Token type=TOKEN_END_TAG_END value='>' range=[12, 13] start=1:12 end=1:13>\n"
    "#<Token type=TOKEN_EOF value='' range=[13, 13] start=1:13 end=1:13>\n"
  );

  buffer_free(&output);
END

TEST(test_basic_void_tag)
  char* html = "<img />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='img' range=[1, 4] start=1:1 end=1:4>\n"
    "#<Token type=TOKEN_START_TAG_END_VOID value='/>' range=[5, 7] start=1:5 end=1:7>\n"
    "#<Token type=TOKEN_EOF value='' range=[7, 7] start=1:7 end=1:7>\n"
  );

  buffer_free(&output);
END

TEST(test_namespaced_tag)
  char* html = "<ns:table></ns:table>";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='ns:table' range=[1, 9] start=1:1 end=1:9>\n"
    "#<Token type=TOKEN_START_TAG_END value='>' range=[9, 10] start=1:9 end=1:10>\n"
    "#<Token type=TOKEN_END_TAG_START value='</' range=[10, 12] start=1:10 end=1:12>\n"
    "#<Token type=TOKEN_TAG_NAME value='ns:table' range=[12, 20] start=1:12 end=1:20>\n"
    "#<Token type=TOKEN_END_TAG_END value='>' range=[20, 21] start=1:20 end=1:21>\n"
    "#<Token type=TOKEN_EOF value='' range=[21, 21] start=1:21 end=1:21>\n"
  );

  buffer_free(&output);
END

TEST(test_text_content)
  char* html = "<h1>Hello World</h1>";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='h1' range=[1, 3] start=1:1 end=1:3>\n"
    "#<Token type=TOKEN_START_TAG_END value='>' range=[3, 4] start=1:3 end=1:4>\n"
    "#<Token type=TOKEN_TEXT_CONTENT value='Hello World' range=[4, 15] start=1:4 end=1:15>\n"
    "#<Token type=TOKEN_END_TAG_START value='</' range=[15, 17] start=1:15 end=1:17>\n"
    "#<Token type=TOKEN_TAG_NAME value='h1' range=[17, 19] start=1:17 end=1:19>\n"
    "#<Token type=TOKEN_END_TAG_END value='>' range=[19, 20] start=1:19 end=1:20>\n"
    "#<Token type=TOKEN_EOF value='' range=[20, 20] start=1:20 end=1:20>\n"
  );

  buffer_free(&output);
END

TEST(test_attribute_value_double_quotes)
  char* html = "<img value=\"hello world\" />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='img' range=[1, 4] start=1:1 end=1:4>\n"
    "#<Token type=TOKEN_ATTRIBUTE_NAME value='value' range=[5, 10] start=1:5 end=1:10>\n"
    "#<Token type=TOKEN_EQUALS value='=' range=[10, 11] start=1:10 end=1:11>\n"
    "#<Token type=TOKEN_DOUBLE_QUOTE value='\"' range=[11, 12] start=1:11 end=1:12>\n"
    "#<Token type=TOKEN_ATTRIBUTE_VALUE value='hello world' range=[12, 23] start=1:12 end=1:23>\n"
    "#<Token type=TOKEN_DOUBLE_QUOTE value='\"' range=[23, 24] start=1:23 end=1:24>\n"
    "#<Token type=TOKEN_START_TAG_END_VOID value='/>' range=[25, 27] start=1:25 end=1:27>\n"
    "#<Token type=TOKEN_EOF value='' range=[27, 27] start=1:27 end=1:27>\n"
  );

  buffer_free(&output);
END

TEST(test_attribute_value_single_quotes)
  char* html = "<img value='hello world' />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='img' range=[1, 4] start=1:1 end=1:4>\n"
    "#<Token type=TOKEN_ATTRIBUTE_NAME value='value' range=[5, 10] start=1:5 end=1:10>\n"
    "#<Token type=TOKEN_EQUALS value='=' range=[10, 11] start=1:10 end=1:11>\n"
    "#<Token type=TOKEN_SINGLE_QUOTE value=''' range=[11, 12] start=1:11 end=1:12>\n"
    "#<Token type=TOKEN_ATTRIBUTE_VALUE value='hello world' range=[12, 23] start=1:12 end=1:23>\n"
    "#<Token type=TOKEN_SINGLE_QUOTE value=''' range=[23, 24] start=1:23 end=1:24>\n"
    "#<Token type=TOKEN_START_TAG_END_VOID value='/>' range=[25, 27] start=1:25 end=1:27>\n"
    "#<Token type=TOKEN_EOF value='' range=[27, 27] start=1:27 end=1:27>\n"
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
//     "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
//     "#<Token type=TOKEN_TAG_NAME value='img' range=[1, 4] start=1:1 end=1:4>\n"
//     "#<Token type=TOKEN_ATTRIBUTE_NAME value='value' range=[5, 10] start=1:5 end=1:10>\n"
//     "#<Token type=TOKEN_EQUALS value='=' range=[10, 11] start=1:10 end=1:11>\n"
//     "#<Token type=TOKEN_ATTRIBUTE_VALUE value='hello' range=[11, 17] start=1:11 end=1:17>\n"
//     "#<Token type=TOKEN_START_TAG_END_VOID value='/>' range=[17, 19] start=1:17 end=1:19>\n"
//     "#<Token type=TOKEN_EOF value='' range=[19, 19] start=1:19 end=1:19>\n"
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
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='img' range=[1, 4] start=1:1 end=1:4>\n"
    "#<Token type=TOKEN_ATTRIBUTE_NAME value='value' range=[5, 10] start=1:5 end=1:10>\n"
    "#<Token type=TOKEN_EQUALS value='=' range=[10, 11] start=1:10 end=1:11>\n"
    "#<Token type=TOKEN_DOUBLE_QUOTE value='\"' range=[11, 12] start=1:11 end=1:12>\n"
    "#<Token type=TOKEN_ATTRIBUTE_VALUE value='' range=[12, 12] start=1:12 end=1:12>\n"
    "#<Token type=TOKEN_DOUBLE_QUOTE value='\"' range=[12, 13] start=1:12 end=1:13>\n"
    "#<Token type=TOKEN_START_TAG_END_VOID value='/>' range=[14, 16] start=1:14 end=1:16>\n"
    "#<Token type=TOKEN_EOF value='' range=[16, 16] start=1:16 end=1:16>\n"
  );

  buffer_free(&output);
END

TEST(test_attribute_value_empty_single_quotes)
  char* html = "<img value='' />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='img' range=[1, 4] start=1:1 end=1:4>\n"
    "#<Token type=TOKEN_ATTRIBUTE_NAME value='value' range=[5, 10] start=1:5 end=1:10>\n"
    "#<Token type=TOKEN_EQUALS value='=' range=[10, 11] start=1:10 end=1:11>\n"
    "#<Token type=TOKEN_SINGLE_QUOTE value=''' range=[11, 12] start=1:11 end=1:12>\n"
    "#<Token type=TOKEN_ATTRIBUTE_VALUE value='' range=[12, 12] start=1:12 end=1:12>\n"
    "#<Token type=TOKEN_SINGLE_QUOTE value=''' range=[12, 13] start=1:12 end=1:13>\n"
    "#<Token type=TOKEN_START_TAG_END_VOID value='/>' range=[14, 16] start=1:14 end=1:16>\n"
    "#<Token type=TOKEN_EOF value='' range=[16, 16] start=1:16 end=1:16>\n"
  );

  buffer_free(&output);
END

TEST(test_boolean_attribute)
  char* html = "<img required />";
  buffer_T output;

  erbx_lex_to_buffer(html, &output);

  ck_assert_str_eq(
    output.value,
    "#<Token type=TOKEN_START_TAG_START value='<' range=[0, 1] start=1:0 end=1:1>\n"
    "#<Token type=TOKEN_TAG_NAME value='img' range=[1, 4] start=1:1 end=1:4>\n"
    "#<Token type=TOKEN_ATTRIBUTE_NAME value='required' range=[5, 13] start=1:5 end=1:13>\n"
    "#<Token type=TOKEN_START_TAG_END_VOID value='/>' range=[14, 16] start=1:14 end=1:16>\n"
    "#<Token type=TOKEN_EOF value='' range=[16, 16] start=1:16 end=1:16>\n"
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

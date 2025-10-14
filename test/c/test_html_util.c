#include <stdio.h>
#include "include/test.h"
#include "../../src/include/herb.h"
#include "../../src/include/html_util.h"

TEST(html_util_html_closing_tag_string)
  ck_assert_str_eq(html_closing_tag_string(NULL), "</>");
  ck_assert_str_eq(html_closing_tag_string(""), "</>");
  ck_assert_str_eq(html_closing_tag_string(" "), "</ >");
  ck_assert_str_eq(html_closing_tag_string("div"), "</div>");
  ck_assert_str_eq(html_closing_tag_string("somelongerstring"), "</somelongerstring>");
END

TEST(html_util_html_self_closing_tag_string)
  ck_assert_str_eq(html_self_closing_tag_string(NULL), "< />");
  ck_assert_str_eq(html_self_closing_tag_string(""), "< />");
  ck_assert_str_eq(html_self_closing_tag_string(" "), "<  />");
  ck_assert_str_eq(html_self_closing_tag_string("br"), "<br />");
  ck_assert_str_eq(html_self_closing_tag_string("somelongerstring"), "<somelongerstring />");
END

TCase *html_util_tests(void) {
  TCase *html_util = tcase_create("HTML Util");

  tcase_add_test(html_util, html_util_html_closing_tag_string);
  tcase_add_test(html_util, html_util_html_closing_tag_string);
  tcase_add_test(html_util, html_util_html_self_closing_tag_string);

  return html_util;
}

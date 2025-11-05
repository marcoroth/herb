#include "../../src/include/herb.h"
#include "../../src/include/html_util.h"
#include "include/test.h"
#include <stdio.h>

TEST(html_util_html_closing_tag_string)
  ck_assert(hb_string_equals(html_closing_tag_string((hb_string_T) { .data = NULL, .length = 0 }), hb_string("</>")));
  ck_assert(hb_string_equals(html_closing_tag_string(hb_string("")), hb_string("</>")));
  ck_assert(hb_string_equals(html_closing_tag_string(hb_string(" ")), hb_string("</ >")));
  ck_assert(hb_string_equals(html_closing_tag_string(hb_string("div")), hb_string("</div>")));

  ck_assert(hb_string_equals(
    html_closing_tag_string(hb_string("somelongerstring")),
    hb_string("</somelongerstring>")
  ));
END

TEST(html_util_html_self_closing_tag_string)
  ck_assert(hb_string_equals(html_self_closing_tag_string((hb_string_T) { .data = NULL, .length = 0 }), hb_string("< />")));
  ck_assert(hb_string_equals(html_self_closing_tag_string(hb_string("")), hb_string("< />")));
  ck_assert(hb_string_equals(html_self_closing_tag_string(hb_string(" ")), hb_string("<  />")));
  ck_assert(hb_string_equals(html_self_closing_tag_string(hb_string("br")), hb_string("<br />")));
  ck_assert(hb_string_equals(html_self_closing_tag_string(hb_string("somelongerstring")), hb_string("<somelongerstring />")));
END

TCase* html_util_tests(void) {
  TCase* html_util = tcase_create("HTML Util");

  tcase_add_test(html_util, html_util_html_closing_tag_string);
  tcase_add_test(html_util, html_util_html_closing_tag_string);
  tcase_add_test(html_util, html_util_html_self_closing_tag_string);

  return html_util;
}

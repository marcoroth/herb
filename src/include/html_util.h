#ifndef HERB_HTML_UTIL_H
#define HERB_HTML_UTIL_H

#include "util/hb_string.h"
#include <stdbool.h>

bool is_void_element(hb_string_T tag_name);
bool has_optional_end_tag(hb_string_T tag_name);
bool should_implicitly_close(hb_string_T open_tag_name, hb_string_T next_tag_name);
bool parent_closes_element(hb_string_T open_tag_name, hb_string_T parent_close_tag_name);

hb_string_T html_closing_tag_string(hb_string_T tag_name);
hb_string_T html_self_closing_tag_string(hb_string_T tag_name);

#endif

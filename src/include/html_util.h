#ifndef HERB_HTML_UTIL_H
#define HERB_HTML_UTIL_H

#include "util/hb_string.h"
#include <stdbool.h>

bool is_void_element(hb_string_T tag_name);

hb_string_T html_closing_tag_string(hb_string_T tag_name);
hb_string_T html_self_closing_tag_string(hb_string_T tag_name);

#endif

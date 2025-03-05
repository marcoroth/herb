#ifndef ERBX_HTML_UTIL_H
#define ERBX_HTML_UTIL_H

#include <stdbool.h>

bool is_void_element(const char* tag_name);

char* html_opening_tag_string(const char* tag_name);
char* html_closing_tag_string(const char* tag_name);
char* html_self_closing_tag_string(const char* tag_name);

#endif

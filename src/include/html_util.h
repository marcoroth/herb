#ifndef HERB_HTML_UTIL_H
#define HERB_HTML_UTIL_H

#include "memory_arena.h"
#include <stdbool.h>

bool is_void_element(const char* tag_name);
bool is_html4_void_element(const char* tag_name);

char* html_opening_tag_string(arena_allocator_T* allocator, const char* tag_name);
char* html_closing_tag_string(arena_allocator_T* allocator, const char* tag_name);
char* html_self_closing_tag_string(arena_allocator_T* allocator, const char* tag_name);

#endif

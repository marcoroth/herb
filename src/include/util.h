#ifndef HERB_UTIL_H
#define HERB_UTIL_H

#include "memory_arena.h"
#include <stdbool.h>
#include <stdlib.h>

int is_whitespace(int character);
int is_newline(int character);

char* escape_newlines(arena_allocator_T* allocator, const char* input);
char* quoted_string(arena_allocator_T* allocator, const char* input);
char* wrap_string(arena_allocator_T* allocator, const char* input, char character);

bool string_blank(const char* input);
bool string_present(const char* input);

char* herb_strdup(arena_allocator_T* allocator, const char* s);

char* size_t_to_string(arena_allocator_T* allocator, size_t value);

#endif

#ifndef HERB_BUFFER_H
#define HERB_BUFFER_H

#include "hb_arena.h"
#include "hb_string.h"

#include <stdbool.h>
#include <stdlib.h>

typedef struct HB_BUFFER_STRUCT {
  hb_arena_T* allocator;
  char* value;
  size_t length;
  size_t capacity;
} hb_buffer_T;

bool hb_buffer_init(hb_buffer_T* buffer, size_t capacity);
bool hb_buffer_init_arena(hb_buffer_T* buffer, hb_arena_T* allocator, size_t capacity);

void hb_buffer_append(hb_buffer_T* buffer, const char* text);
void hb_buffer_append_with_length(hb_buffer_T* buffer, const char* text, size_t length);
void hb_buffer_append_string(hb_buffer_T* buffer, hb_string_T string);
void hb_buffer_append_char(hb_buffer_T* buffer, char character);
void hb_buffer_append_whitespace(hb_buffer_T* buffer, size_t length);
void hb_buffer_prepend(hb_buffer_T* buffer, const char* text);
void hb_buffer_concat(hb_buffer_T* destination, hb_buffer_T* source);

char* hb_buffer_value(const hb_buffer_T* buffer);

size_t hb_buffer_length(const hb_buffer_T* buffer);
bool hb_buffer_is_empty(const hb_buffer_T* buffer);
size_t hb_buffer_capacity(const hb_buffer_T* buffer);
size_t hb_buffer_sizeof(void);

void hb_buffer_clear(hb_buffer_T* buffer);

#endif

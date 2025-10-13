#ifndef HERB_BUFFER_H
#define HERB_BUFFER_H

#include <stdbool.h>
#include <stdlib.h>

typedef struct HB_BUFFER_STRUCT {
  char* value;
  size_t length;
  size_t capacity;
} hb_buffer_T;

bool hb_buffer_init(hb_buffer_T* buffer, size_t capacity);

bool hb_buffer_increase_capacity(hb_buffer_T* buffer, size_t additional_capacity);
bool hb_buffer_has_capacity(hb_buffer_T* buffer, size_t required_length);
bool hb_buffer_expand_if_needed(hb_buffer_T* buffer, size_t required_length);
bool hb_buffer_resize(hb_buffer_T* buffer, size_t new_capacity);

void hb_buffer_append(hb_buffer_T* buffer, const char* text);
void hb_buffer_append_with_length(hb_buffer_T* buffer, const char* text, size_t length);
void hb_buffer_append_char(hb_buffer_T* buffer, char character);
void hb_buffer_append_repeated(hb_buffer_T* buffer, char character, size_t length);
void hb_buffer_append_whitespace(hb_buffer_T* buffer, size_t length);
void hb_buffer_prepend(hb_buffer_T* buffer, const char* text);
void hb_buffer_concat(hb_buffer_T* destination, hb_buffer_T* source);

char* hb_buffer_value(const hb_buffer_T* buffer);

size_t hb_buffer_length(const hb_buffer_T* buffer);
size_t hb_buffer_capacity(const hb_buffer_T* buffer);
size_t hb_buffer_sizeof(void);

void hb_buffer_clear(hb_buffer_T* buffer);
void hb_buffer_free(hb_buffer_T** buffer);

#endif

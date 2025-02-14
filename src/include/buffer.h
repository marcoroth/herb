#ifndef ERBX_BUFFER_H
#define ERBX_BUFFER_H

#include <stdbool.h>
#include <stdlib.h>

typedef struct BUFFER_STRUCT {
  char* value;
  size_t length;
  size_t capacity;
} buffer_T;

bool buffer_init(buffer_T* buffer);
buffer_T buffer_new(void);

bool buffer_increase_capacity(buffer_T* buffer, size_t required_length);
bool buffer_reserve(buffer_T* buffer, size_t min_capacity);

void buffer_append(buffer_T* buffer, const char* text);
void buffer_append_repeated(buffer_T* buffer, char character, size_t length);
void buffer_append_whitespace(buffer_T* buffer, size_t length);
void buffer_prepend(buffer_T* buffer, const char* text);
void buffer_concat(buffer_T* destination, buffer_T* source);

char* buffer_value(buffer_T* buffer);

size_t buffer_length(buffer_T* buffer);
size_t buffer_capacity(buffer_T* buffer);
size_t buffer_sizeof(void);

void buffer_clear(buffer_T* buffer);
void buffer_free(buffer_T* buffer);

#endif

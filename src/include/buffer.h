#ifndef ERBX_BUFFER_H
#define ERBX_BUFFER_H

#include <stdlib.h>

typedef struct {
  char* value;
  size_t size;
  size_t capacity;
} buffer;

void init_buffer(buffer* buffer);
void buffer_append(buffer* buffer, const char* text);
void buffer_prepend(buffer* buffer, const char* text);
void buffer_concat(buffer* destination, buffer* source);
void buffer_free(buffer* buffer);

#endif

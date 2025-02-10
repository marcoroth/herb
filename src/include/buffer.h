#ifndef ERBX_BUFFER_H
#define ERBX_BUFFER_H

#include <stdbool.h>
#include <stdlib.h>

typedef struct BUFFER_STRUCT {
  char *value;
  size_t length;
  size_t capacity;
} buffer_T;

bool buffer_init(buffer_T *buffer);

void buffer_append(buffer_T *buffer, const char *text);
void buffer_prepend(buffer_T *buffer, const char *text);
void buffer_concat(buffer_T *destination, buffer_T *source);
void buffer_free(buffer_T *buffer);

char *buffer_value(buffer_T *buffer);

size_t buffer_length(buffer_T *buffer);
size_t buffer_capacity(buffer_T *buffer);
size_t buffer_sizeof(void);

#endif

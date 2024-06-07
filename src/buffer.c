#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "include/buffer.h"

bool buffer_init(buffer_T* buffer) {
  buffer->capacity = 1024;
  buffer->length = 0;
  buffer->value = malloc(buffer->capacity * sizeof(char));

  if (buffer->value) {
    buffer->value[0] = '\0';
  }

  return buffer != NULL;
}

char* buffer_value(buffer_T* buffer) {
  return buffer->value;
}

size_t buffer_length(buffer_T* buffer) {
  return buffer->length;
}

size_t buffer_capacity(buffer_T* buffer) {
  return buffer->capacity;
}

size_t buffer_sizeof(void) {
  return sizeof(buffer_T);
}

void buffer_append(buffer_T* buffer, const char* text) {
  size_t text_length = strlen(text);

  if (buffer->length + text_length >= buffer->capacity) {
    size_t new_capacity = (buffer->length + text_length) * 2;
    char* new_buffer = realloc(buffer->value, new_capacity);

    if (new_buffer) {
      buffer->value = new_buffer;
      buffer->capacity = new_capacity;
    } else {
      printf("Couldn't allocate memory for new_buffer in buffer_append");
      return;
    }
  }

  strcat(buffer->value + buffer->length, text);
  buffer->length += text_length;
}

void buffer_prepend(buffer_T* buffer, const char* text) {
  if (text == NULL || text[0] == '\0') return;

  size_t text_length = strlen(text);
  size_t new_length = buffer->length + text_length;

  if (new_length >= buffer->capacity) {
    size_t new_capacity = new_length * 2;
    buffer->value = realloc(buffer->value, new_capacity);
    buffer->capacity = new_capacity;
  }

  memmove(buffer->value + text_length, buffer->value, buffer->length + 1);
  memcpy(buffer->value, text, text_length);

  buffer->length = new_length;
  buffer->value[buffer->length] = '\0';
}

void buffer_concat(buffer_T* destination, buffer_T* source) {
  if (source->length == 0) return;

  size_t new_length = destination->length + source->length;

  if (new_length >= destination->capacity) {
    size_t new_capacity = new_length * 2;
    destination->value = realloc(destination->value, new_capacity);
    destination->capacity = new_capacity;
  }

  strcat(destination->value + destination->length, source->value);

  destination->length = new_length;
}

void buffer_free(buffer_T* buffer) {
  free(buffer->value);
  buffer->value = NULL;
  buffer->length = buffer->capacity = 0;
}

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "include/buffer.h"

void init_buffer(buffer* buffer) {
  buffer->capacity = 1024;
  buffer->size = 0;
  buffer->value = malloc(buffer->capacity * sizeof(char));

  if (buffer->value) {
    buffer->value[0] = '\0';
  }
}

void buffer_append(buffer* buffer, const char* text) {
  size_t text_length = strlen(text);

  if (buffer->size + text_length >= buffer->capacity) {
    size_t new_capacity = (buffer->size + text_length) * 2;
    char* new_buffer = realloc(buffer->value, new_capacity);

    if (new_buffer) {
      buffer->value = new_buffer;
      buffer->capacity = new_capacity;
    } else {
      printf("Couldn't allocate memory for new_buffer in buffer_append");
      return;
    }
  }

  strcat(buffer->value + buffer->size, text);
  buffer->size += text_length;
}

void buffer_prepend(buffer* buffer, const char* text) {
  if (text == NULL || text[0] == '\0') return;

  size_t text_length = strlen(text);
  size_t new_size = buffer->size + text_length;

  if (new_size >= buffer->capacity) {
    size_t new_capacity = new_size * 2;
    buffer->value = realloc(buffer->value, new_capacity);
    buffer->capacity = new_capacity;
  }

  memmove(buffer->value + text_length, buffer->value, buffer->size + 1);
  memcpy(buffer->value, text, text_length);

  buffer->size = new_size;
  buffer->value[buffer->size] = '\0';
}

void buffer_concat(buffer* destination, buffer* source) {
  if (source->size == 0) return;

  size_t new_size = destination->size + source->size;

  if (new_size >= destination->capacity) {
    size_t new_capacity = new_size * 2;
    destination->value = realloc(destination->value, new_capacity);
    destination->capacity = new_capacity;
  }

  strcat(destination->value + destination->size, source->value);

  destination->size = new_size;
}

void buffer_free(buffer* buffer) {
  free(buffer->value);
  buffer->value = NULL;
  buffer->size = buffer->capacity = 0;
}

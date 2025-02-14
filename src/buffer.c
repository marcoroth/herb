#include <stdio.h>
#include <string.h>

#include "include/buffer.h"
#include "include/macros.h"
#include "include/memory.h"

bool buffer_init(buffer_T* buffer) {
  buffer->capacity = 1024;
  buffer->length = 0;
  buffer->value = nullable_safe_malloc(buffer->capacity * sizeof(char));

  if (!buffer->value) {
    fprintf(stderr, "Error: Failed to initialize buffer with capacity of %zu.\n", buffer->capacity);
    return false;
  }

  buffer->value[0] = '\0';

  return true;
}

buffer_T buffer_new(void) {
  buffer_T buffer;
  buffer_init(&buffer);
  return buffer;
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

bool buffer_increase_capacity(buffer_T* buffer, size_t required_length) {
  size_t required_capacity = buffer->length + required_length;

  if (buffer->capacity >= required_capacity) return true;

  size_t new_capacity = required_capacity * 2;
  char* new_value = safe_realloc(buffer->value, new_capacity);

  if (unlikely(new_value == NULL)) return false;

  buffer->value = new_value;
  buffer->capacity = new_capacity;

  return true;
}

void buffer_append(buffer_T* buffer, const char* text) {
  if (!text || text[0] == '\0') return;

  size_t text_length = strlen(text);

  if (!buffer_increase_capacity(buffer, text_length)) return;

  strcat(buffer->value + buffer->length, text);
  buffer->length += text_length;
}

void buffer_append_char(buffer_T* buffer, char character) {
  if (!buffer_increase_capacity(buffer, 1)) return;

  buffer->value[buffer->length] = character;
  buffer->length++;
  buffer->value[buffer->length] = '\0';
}

void buffer_append_repeated(buffer_T* buffer, char character, size_t length) {
  if (length == 0) return;

  char* spaces = malloc(length + 1);
  if (!spaces) return;

  memset(spaces, character, length);
  spaces[length] = '\0';

  buffer_append(buffer, spaces);

  free(spaces);
}

void buffer_prepend(buffer_T* buffer, const char* text) {
  if (!text || text[0] == '\0') return;

  size_t text_length = strlen(text);

  if (!buffer_increase_capacity(buffer, text_length)) return;

  memmove(buffer->value + text_length, buffer->value, buffer->length + 1);
  memcpy(buffer->value, text, text_length);

  buffer->length += text_length;
}

void buffer_append_whitespace(buffer_T* buffer, size_t length) {
  buffer_append_repeated(buffer, ' ', length);
}

void buffer_concat(buffer_T* destination, buffer_T* source) {
  if (source->length == 0) return;
  if (!buffer_increase_capacity(destination, source->length)) return;

  memcpy(destination->value + destination->length, source->value, source->length);
  destination->length += source->length;
  destination->value[destination->length] = '\0';
}

bool buffer_reserve(buffer_T* buffer, size_t min_capacity) {
  size_t required_length = min_capacity - buffer->length;

  return buffer_increase_capacity(buffer, required_length);
}

void buffer_clear(buffer_T* buffer) {
  buffer->length = 0;
  buffer->value[0] = '\0';
}

void buffer_free(buffer_T* buffer) {
  if (!buffer) return;

  free(buffer->value);

  buffer->value = NULL;
  buffer->length = buffer->capacity = 0;
}

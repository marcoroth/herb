#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "include/buffer.h"
#include "include/macros.h"
#include "include/memory.h"
#include "include/util.h"

bool buffer_init(buffer_T* buffer) {
  buffer->capacity = 8192;
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

char* buffer_value(const buffer_T* buffer) {
  return buffer->value;
}

size_t buffer_length(const buffer_T* buffer) {
  return buffer->length;
}

size_t buffer_capacity(const buffer_T* buffer) {
  return buffer->capacity;
}

size_t buffer_sizeof(void) {
  return sizeof(buffer_T);
}

/**
 * Increases the capacity of the buffer if needed to accommodate additional content.
 * This function only handles memory allocation and does not modify the buffer content
 * or null termination.
 *
 * @param buffer The buffer to increase capacity for
 * @param required_length The additional length needed beyond current buffer length
 * @return true if capacity is sufficient (either already or after reallocation),
 *         false if reallocation failed
 */
bool buffer_increase_capacity(buffer_T* buffer, const size_t required_length) {
  if (SIZE_MAX - buffer->length < required_length) {
    fprintf(stderr, "Error: Buffer capacity would overflow system limits.\n");
    return false;
  }

  const size_t required_capacity = buffer->length + required_length;

  if (buffer->capacity >= required_capacity) { return true; }

  size_t new_capacity;
  if (required_capacity > SIZE_MAX / 2) {
    new_capacity = required_capacity + 1024;

    if (new_capacity < required_capacity) { new_capacity = SIZE_MAX; }
  } else {
    new_capacity = required_capacity * 2;
  }

  char* new_value = safe_realloc(buffer->value, new_capacity);

  if (unlikely(new_value == NULL)) { return false; }

  buffer->value = new_value;
  buffer->capacity = new_capacity;

  return true;
}

/**
 * Appends a null-terminated string to the buffer.
 * @note This function requires that 'text' is a properly null-terminated string.
 * When reading data from files or other non-string sources, ensure the data is
 * null-terminated before calling this function, or use buffer_append_with_length instead.
 *
 * @param buffer The buffer to append to
 * @param text A null-terminated string to append
 * @return void
 */
void buffer_append(buffer_T* buffer, const char* text) {
  if (!buffer || !text) { return; }
  if (text[0] == '\0') { return; }

  size_t text_length = strlen(text);

  if (!buffer_increase_capacity(buffer, text_length)) { return; }

  memcpy(buffer->value + buffer->length, text, text_length);
  buffer->length += text_length;
  buffer->value[buffer->length] = '\0';
}

/**
 * Appends a string of specified length to the buffer.
 * Unlike buffer_append(), this function does not require the text to be
 * null-terminated as it uses the provided length instead of strlen().
 * This is particularly useful when working with data from files, network
 * buffers, or other non-null-terminated sources.
 *
 * @param buffer The buffer to append to
 * @param text The text to append (doesn't need to be null-terminated)
 * @param length The number of bytes to append from text
 * @return void
 */
void buffer_append_with_length(buffer_T* buffer, const char* text, const size_t length) {
  if (!buffer || !text || length == 0) { return; }
  if (!buffer_increase_capacity(buffer, length)) { return; }

  memcpy(buffer->value + buffer->length, text, length);

  buffer->length += length;
  buffer->value[buffer->length] = '\0';
}

void buffer_append_char(buffer_T* buffer, const char character) {
  static char string[2];

  string[0] = character;
  string[1] = '\0';

  buffer_append(buffer, string);
}

void buffer_append_repeated(buffer_T* buffer, const char character, size_t length) {
  if (length == 0) { return; }

  char* spaces = malloc(length + 1);
  if (!spaces) { return; }

  memset(spaces, character, length);
  spaces[length] = '\0';

  buffer_append(buffer, spaces);

  free(spaces);
}

void buffer_append_whitespace(buffer_T* buffer, const size_t length) {
  buffer_append_repeated(buffer, ' ', length);
}

void buffer_prepend(buffer_T* buffer, const char* text) {
  if (!buffer || !text) { return; }
  if (text[0] == '\0') { return; }

  size_t text_length = strlen(text);

  if (!buffer_increase_capacity(buffer, text_length)) { return; }

  memmove(buffer->value + text_length, buffer->value, buffer->length + 1);
  memcpy(buffer->value, text, text_length);

  buffer->length += text_length;
}

void buffer_concat(buffer_T* destination, buffer_T* source) {
  if (source->length == 0) { return; }
  if (!buffer_increase_capacity(destination, source->length)) { return; }

  memcpy(destination->value + destination->length, source->value, source->length);
  destination->length += source->length;
  destination->value[destination->length] = '\0';
}

bool buffer_reserve(buffer_T* buffer, const size_t min_capacity) {
  const size_t required_length = min_capacity - buffer->length;

  return buffer_increase_capacity(buffer, required_length);
}

void buffer_clear(buffer_T* buffer) {
  buffer->length = 0;
  buffer->value[0] = '\0';
}

void buffer_free(buffer_T* buffer) {
  if (!buffer) { return; }

  free(buffer->value);

  buffer->value = NULL;
  buffer->length = buffer->capacity = 0;
}

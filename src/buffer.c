#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "include/buffer.h"
#include "include/macros.h"
#include "include/memory.h"
#include "include/util.h"

bool buffer_init(buffer_T* buffer, const size_t capacity) {
  buffer->capacity = capacity;
  buffer->length = 0;
  buffer->value = nullable_safe_malloc((buffer->capacity + 1) * sizeof(char));

  if (!buffer->value) {
    fprintf(stderr, "Error: Failed to initialize buffer with capacity of %zu.\n", buffer->capacity);
    return false;
  }

  buffer->value[0] = '\0';

  return true;
}

buffer_T* buffer_new(const size_t capacity) {
  buffer_T* buffer = safe_malloc(sizeof(buffer_T));

  if (!buffer_init(buffer, capacity)) {
    free(buffer);
    return NULL;
  }

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
 * @param additional_capacity The additional length needed beyond current buffer capacity
 * @return true if capacity was increased, false if reallocation failed
 */
bool buffer_increase_capacity(buffer_T* buffer, const size_t additional_capacity) {
  if (additional_capacity + 1 >= SIZE_MAX) {
    fprintf(stderr, "Error: Buffer capacity would overflow system limits.\n");
    exit(1);
  }

  const size_t new_capacity = buffer->capacity + additional_capacity;

  return buffer_resize(buffer, new_capacity);
}

/**
 * Resizes the capacity of the buffer to the specified new capacity.
 *
 * @param buffer The buffer to resize
 * @param new_capacity The new capacity to resize the buffer to
 * @return true if capacity was resized, false if reallocation failed
 */
bool buffer_resize(buffer_T* buffer, const size_t new_capacity) {
  if (new_capacity + 1 >= SIZE_MAX) {
    fprintf(stderr, "Error: Buffer capacity would overflow system limits.\n");
    exit(1);
  }

  char* new_value = nullable_safe_realloc(buffer->value, new_capacity + 1);

  if (unlikely(new_value == NULL)) {
    fprintf(stderr, "Error: Failed to resize buffer to %zu.\n", new_capacity);
    exit(1);
  }

  buffer->value = new_value;
  buffer->capacity = new_capacity;

  return true;
}

/**
 * Expands the capacity of the buffer by doubling its current capacity.
 * This function is a convenience function that calls buffer_increase_capacity
 * with a factor of 2.
 *
 * @param buffer The buffer to expand capacity for
 * @return true if capacity was increased, false if reallocation failed
 */
bool buffer_expand_capacity(buffer_T* buffer) {
  return buffer_resize(buffer, buffer->capacity * 2);
}

/**
 * Expands the capacity of the buffer if needed to accommodate additional content.
 * This function is a convenience function that calls buffer_has_capacity and
 * buffer_expand_capacity.
 *
 * @param buffer The buffer to expand capacity for
 * @param required_length The additional length needed beyond current buffer capacity
 * @return true if capacity was increased, false if reallocation failed
 */
bool buffer_expand_if_needed(buffer_T* buffer, const size_t required_length) {
  if (buffer_has_capacity(buffer, required_length)) { return true; }

  bool should_double_capacity = required_length < buffer->capacity;
  size_t new_capacity = 0;

  if (should_double_capacity) {
    new_capacity = buffer->capacity * 2;
  } else {
    new_capacity = buffer->capacity + (required_length * 2);
  }

  return buffer_resize(buffer, new_capacity);
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

  if (!buffer_expand_if_needed(buffer, text_length)) { return; }

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
  if (!buffer_expand_if_needed(buffer, length)) { return; }

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

  if (!buffer_expand_if_needed(buffer, text_length)) { return; }

  memmove(buffer->value + text_length, buffer->value, buffer->length + 1);
  memcpy(buffer->value, text, text_length);

  buffer->length += text_length;
}

void buffer_concat(buffer_T* destination, buffer_T* source) {
  if (source->length == 0) { return; }
  if (!buffer_expand_if_needed(destination, source->length)) { return; }

  memcpy(destination->value + destination->length, source->value, source->length);

  destination->length += source->length;
  destination->value[destination->length] = '\0';
}

bool buffer_has_capacity(buffer_T* buffer, const size_t required_length) {
  return (buffer->length + required_length <= buffer->capacity);
}

void buffer_clear(buffer_T* buffer) {
  buffer->length = 0;
  buffer->value[0] = '\0';
}

void buffer_free(buffer_T** buffer) {
  if (!buffer || !*buffer) { return; }

  if ((*buffer)->value != NULL) { free((*buffer)->value); }

  free(*buffer);
  *buffer = NULL;
}

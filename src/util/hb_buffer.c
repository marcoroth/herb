#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "../include/macros.h"
#include "../include/util.h"
#include "../include/util/hb_buffer.h"

bool hb_buffer_init(hb_buffer_T* buffer, const size_t capacity) {
  buffer->capacity = capacity;
  buffer->length = 0;
  buffer->value = malloc(sizeof(char) * (buffer->capacity + 1));

  if (!buffer->value) {
    fprintf(stderr, "Error: Failed to initialize buffer with capacity of %zu.\n", buffer->capacity);

    return false;
  }

  buffer->value[0] = '\0';

  return true;
}

char* hb_buffer_value(const hb_buffer_T* buffer) {
  return buffer->value;
}

size_t hb_buffer_length(const hb_buffer_T* buffer) {
  return buffer->length;
}

size_t hb_buffer_capacity(const hb_buffer_T* buffer) {
  return buffer->capacity;
}

size_t hb_buffer_sizeof(void) {
  return sizeof(hb_buffer_T);
}

/**
 * Resizes the capacity of the buffer to the specified new capacity.
 *
 * @param buffer The buffer to resize
 * @param new_capacity The new capacity to resize the buffer to
 * @return true if capacity was resized, false if reallocation failed
 */
bool hb_buffer_resize(hb_buffer_T* buffer, const size_t new_capacity) {
  if (new_capacity + 1 >= SIZE_MAX) {
    fprintf(stderr, "Error: Buffer capacity would overflow system limits.\n");
    exit(1);
  }

  char* new_value = realloc(buffer->value, new_capacity + 1);

  if (unlikely(new_value == NULL)) {
    fprintf(stderr, "Error: Failed to resize buffer to %zu.\n", new_capacity);
    exit(1);
  }

  buffer->value = new_value;
  buffer->capacity = new_capacity;

  return true;
}

/**
 * Expands the capacity of the buffer if needed to accommodate additional content.
 * This function is a convenience function that calls hb_buffer_has_capacity and
 * hb_buffer_expand_capacity.
 *
 * @param buffer The buffer to expand capacity for
 * @param required_length The additional length needed beyond current buffer capacity
 * @return true if capacity was increased, false if reallocation failed
 */
bool hb_buffer_expand_if_needed(hb_buffer_T* buffer, const size_t required_length) {
  if (hb_buffer_has_capacity(buffer, required_length)) { return true; }

  bool should_double_capacity = required_length < buffer->capacity;
  size_t new_capacity = 0;

  if (should_double_capacity) {
    new_capacity = buffer->capacity * 2;
  } else {
    new_capacity = buffer->capacity + (required_length * 2);
  }

  return hb_buffer_resize(buffer, new_capacity);
}

/**
 * Appends a null-terminated string to the buffer.
 * @note This function requires that 'text' is a properly null-terminated string.
 * When reading data from files or other non-string sources, ensure the data is
 * null-terminated before calling this function, or use hb_buffer_append_with_length instead.
 *
 * @param buffer The buffer to append to
 * @param text A null-terminated string to append
 * @return void
 */
void hb_buffer_append(hb_buffer_T* buffer, const char* text) {
  if (!buffer || !text) { return; }
  if (text[0] == '\0') { return; }

  size_t text_length = strlen(text);

  if (!hb_buffer_expand_if_needed(buffer, text_length)) { return; }

  memcpy(buffer->value + buffer->length, text, text_length);
  buffer->length += text_length;
  buffer->value[buffer->length] = '\0';
}

/**
 * Appends a string of specified length to the buffer.
 * Unlike hb_buffer_append(), this function does not require the text to be
 * null-terminated as it uses the provided length instead of strlen().
 * This is particularly useful when working with data from files, network
 * buffers, or other non-null-terminated sources.
 *
 * @param buffer The buffer to append to
 * @param text The text to append (doesn't need to be null-terminated)
 * @param length The number of bytes to append from text
 * @return void
 */
void hb_buffer_append_with_length(hb_buffer_T* buffer, const char* text, const size_t length) {
  if (!buffer || !text || length == 0) { return; }
  if (!hb_buffer_expand_if_needed(buffer, length)) { return; }

  memcpy(buffer->value + buffer->length, text, length);

  buffer->length += length;
  buffer->value[buffer->length] = '\0';
}

void hb_buffer_append_char(hb_buffer_T* buffer, const char character) {
  static char string[2];

  string[0] = character;
  string[1] = '\0';

  hb_buffer_append(buffer, string);
}

void hb_buffer_append_repeated(hb_buffer_T* buffer, const char character, size_t length) {
  if (!buffer || length == 0) { return; }
  if (!hb_buffer_expand_if_needed(buffer, length)) { return; }

  memset(buffer->value + buffer->length, character, length);

  buffer->length += length;
  buffer->value[buffer->length] = '\0';
}

void hb_buffer_append_whitespace(hb_buffer_T* buffer, const size_t length) {
  hb_buffer_append_repeated(buffer, ' ', length);
}

void hb_buffer_prepend(hb_buffer_T* buffer, const char* text) {
  if (!buffer || !text) { return; }
  if (text[0] == '\0') { return; }

  size_t text_length = strlen(text);

  if (!hb_buffer_expand_if_needed(buffer, text_length)) { return; }

  memmove(buffer->value + text_length, buffer->value, buffer->length + 1);
  memcpy(buffer->value, text, text_length);

  buffer->length += text_length;
}

void hb_buffer_concat(hb_buffer_T* destination, hb_buffer_T* source) {
  if (source->length == 0) { return; }
  if (!hb_buffer_expand_if_needed(destination, source->length)) { return; }

  memcpy(destination->value + destination->length, source->value, source->length);

  destination->length += source->length;
  destination->value[destination->length] = '\0';
}

bool hb_buffer_has_capacity(hb_buffer_T* buffer, const size_t required_length) {
  return (buffer->length + required_length <= buffer->capacity);
}

void hb_buffer_clear(hb_buffer_T* buffer) {
  buffer->length = 0;
  buffer->value[0] = '\0';
}

void hb_buffer_free(hb_buffer_T** buffer) {
  if (!buffer || !*buffer) { return; }

  if ((*buffer)->value != NULL) { free((*buffer)->value); }

  free(*buffer);
  *buffer = NULL;
}

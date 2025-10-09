#ifndef HERB_BUFFER_H
#define HERB_BUFFER_H

#include "memory_arena.h"
#include <stdbool.h>
#include <stdlib.h>

typedef struct BUFFER_STRUCT {
  char* value;
  size_t length;
  size_t capacity;
} buffer_T;

bool buffer_init(arena_allocator_T* allocator, buffer_T* buffer, size_t capacity);
buffer_T* buffer_new(arena_allocator_T* allocator, size_t capacity);

bool buffer_increase_capacity(arena_allocator_T* allocator, buffer_T* buffer, size_t additional_capacity);
bool buffer_has_capacity(buffer_T* buffer, size_t required_length);
bool buffer_expand_capacity(arena_allocator_T* allocator, buffer_T* buffer);
bool buffer_expand_if_needed(arena_allocator_T* allocator, buffer_T* buffer, size_t required_length);
bool buffer_resize(arena_allocator_T* allocator, buffer_T* buffer, size_t new_capacity);

void buffer_append(arena_allocator_T* allocator, buffer_T* buffer, const char* text);
void buffer_append_with_length(arena_allocator_T* allocator, buffer_T* buffer, const char* text, size_t length);
void buffer_append_char(arena_allocator_T* allocator, buffer_T* buffer, char character);
void buffer_append_repeated(arena_allocator_T* allocator, buffer_T* buffer, char character, size_t length);
void buffer_append_whitespace(arena_allocator_T* allocator, buffer_T* buffer, size_t length);
void buffer_prepend(arena_allocator_T* allocator, buffer_T* buffer, const char* text);
void buffer_concat(arena_allocator_T* allocator, buffer_T* destination, buffer_T* source);

char* buffer_value(const buffer_T* buffer);

size_t buffer_length(const buffer_T* buffer);
size_t buffer_capacity(const buffer_T* buffer);
size_t buffer_sizeof(void);

void buffer_clear(buffer_T* buffer);
void buffer_free(buffer_T** buffer);

#endif

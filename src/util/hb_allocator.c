#include "../include/util/hb_allocator.h"
#include "../include/util/hb_arena.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// --- Malloc backend ---

static void* malloc_alloc(hb_allocator_T* _self, size_t size) {
  return calloc(1, size);
}

static void malloc_dealloc(hb_allocator_T* _self, void* pointer) {
  free(pointer);
}

static char* malloc_strdup(hb_allocator_T* _self, const char* string) {
  if (!string) { return NULL; }

  size_t length = strlen(string);
  char* copy = malloc(length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length + 1);

  return copy;
}

static char* malloc_strndup(hb_allocator_T* _self, const char* string, size_t length) {
  if (!string) { return NULL; }

  char* copy = malloc(length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length);
  copy[length] = '\0';

  return copy;
}

static void malloc_destroy(hb_allocator_T* _self) {
}

hb_allocator_T hb_allocator_with_malloc(void) {
  return (hb_allocator_T) {
    .alloc = malloc_alloc,
    .dealloc = malloc_dealloc,
    .strdup = malloc_strdup,
    .strndup = malloc_strndup,
    .destroy = malloc_destroy,
    .context = NULL,
  };
}

// --- Arena backend ---

static void* arena_alloc(hb_allocator_T* self, size_t size) {
  return hb_arena_alloc((hb_arena_T*) self->context, size);
}

static void arena_dealloc(hb_allocator_T* _self, void* _pointer) {
}

static char* arena_strdup(hb_allocator_T* self, const char* string) {
  if (!string) { return NULL; }

  size_t length = strlen(string);
  char* copy = hb_arena_alloc((hb_arena_T*) self->context, length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length + 1);

  return copy;
}

static char* arena_strndup(hb_allocator_T* self, const char* string, size_t length) {
  if (!string) { return NULL; }

  char* copy = hb_arena_alloc((hb_arena_T*) self->context, length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length);
  copy[length] = '\0';

  return copy;
}

static void arena_destroy(hb_allocator_T* self) {
  hb_arena_T* arena = (hb_arena_T*) self->context;
  hb_arena_free(arena);
  free(arena);
  self->context = NULL;
}

hb_allocator_T hb_allocator_with_arena(hb_arena_T* arena) {
  return (hb_allocator_T) {
    .alloc = arena_alloc,
    .dealloc = arena_dealloc,
    .strdup = arena_strdup,
    .strndup = arena_strndup,
    .destroy = arena_destroy,
    .context = arena,
  };
}

// --- Tracking backend ---

#define TRACKING_INITIAL_CAPACITY 128
#define TRACKING_TOMBSTONE ((void*) 1)

static size_t tracking_probe(hb_allocator_tracking_stats_T* stats, void* pointer) {
  size_t mask = stats->buckets_capacity - 1;
  size_t index = ((size_t) pointer >> 4) & mask;

  while (true) {
    void* key = stats->buckets[index].pointer;
    if (key == NULL || key == TRACKING_TOMBSTONE || key == pointer) { return index; }
    index = (index + 1) & mask;
  }
}

static void tracking_grow(hb_allocator_tracking_stats_T* stats) {
  size_t old_capacity = stats->buckets_capacity;
  hb_allocator_tracking_entry_T* old_buckets = stats->buckets;

  size_t new_capacity = old_capacity ? old_capacity * 2 : TRACKING_INITIAL_CAPACITY;
  stats->buckets = calloc(new_capacity, sizeof(hb_allocator_tracking_entry_T));
  stats->buckets_capacity = new_capacity;
  stats->buckets_used = 0;

  for (size_t i = 0; i < old_capacity; i++) {
    if (old_buckets[i].pointer != NULL && old_buckets[i].pointer != TRACKING_TOMBSTONE) {
      size_t index = tracking_probe(stats, old_buckets[i].pointer);
      stats->buckets[index] = old_buckets[i];
      stats->buckets_used++;
    }
  }

  free(old_buckets);
}

static void tracking_record(hb_allocator_tracking_stats_T* stats, void* pointer, size_t size) {
  if (stats->buckets_used * 2 >= stats->buckets_capacity) { tracking_grow(stats); }

  size_t index = tracking_probe(stats, pointer);
  stats->buckets[index] = (hb_allocator_tracking_entry_T) { .pointer = pointer, .size = size };
  stats->buckets_used++;
  stats->allocation_count++;
  stats->bytes_allocated += size;
}

static void tracking_record_untracked(hb_allocator_tracking_stats_T* stats, void* pointer) {
  stats->untracked_deallocation_count++;

  if (stats->untracked_pointers_size >= stats->untracked_pointers_capacity) {
    size_t new_capacity = stats->untracked_pointers_capacity ? stats->untracked_pointers_capacity * 2 : 16;
    void** new_pointers = realloc(stats->untracked_pointers, new_capacity * sizeof(void*));

    if (!new_pointers) { return; }

    stats->untracked_pointers = new_pointers;
    stats->untracked_pointers_capacity = new_capacity;
  }

  stats->untracked_pointers[stats->untracked_pointers_size++] = pointer;
}

static void tracking_unrecord(hb_allocator_tracking_stats_T* stats, void* pointer) {
  if (!stats->buckets_capacity) {
    tracking_record_untracked(stats, pointer);

    return;
  }

  size_t mask = stats->buckets_capacity - 1;
  size_t index = ((size_t) pointer >> 4) & mask;

  while (true) {
    void* key = stats->buckets[index].pointer;

    if (key == NULL) {
      tracking_record_untracked(stats, pointer);

      return;
    }

    if (key == pointer) {
      stats->deallocation_count++;
      stats->bytes_deallocated += stats->buckets[index].size;
      stats->buckets[index].pointer = TRACKING_TOMBSTONE;
      stats->buckets[index].size = 0;

      return;
    }

    index = (index + 1) & mask;
  }
}

static void* tracking_alloc(hb_allocator_T* self, size_t size) {
  hb_allocator_tracking_stats_T* stats = (hb_allocator_tracking_stats_T*) self->context;
  void* pointer = calloc(1, size);

  if (pointer) { tracking_record(stats, pointer, size); }

  return pointer;
}

static void tracking_dealloc(hb_allocator_T* self, void* pointer) {
  hb_allocator_tracking_stats_T* stats = (hb_allocator_tracking_stats_T*) self->context;
  tracking_unrecord(stats, pointer);
  free(pointer);
}

static char* tracking_strdup(hb_allocator_T* self, const char* string) {
  if (!string) { return NULL; }

  hb_allocator_tracking_stats_T* stats = (hb_allocator_tracking_stats_T*) self->context;
  size_t length = strlen(string);
  char* copy = malloc(length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length + 1);
  tracking_record(stats, copy, length + 1);

  return copy;
}

static char* tracking_strndup(hb_allocator_T* self, const char* string, size_t length) {
  if (!string) { return NULL; }

  hb_allocator_tracking_stats_T* stats = (hb_allocator_tracking_stats_T*) self->context;
  char* copy = malloc(length + 1);
  if (!copy) { return NULL; }

  memcpy(copy, string, length);
  copy[length] = '\0';
  tracking_record(stats, copy, length + 1);

  return copy;
}

static void tracking_destroy(hb_allocator_T* self) {
  hb_allocator_tracking_stats_T* stats = (hb_allocator_tracking_stats_T*) self->context;

  free(stats->buckets);
  free(stats->untracked_pointers);
  free(stats);

  self->context = NULL;
}

hb_allocator_T hb_allocator_with_tracking(void) {
  hb_allocator_tracking_stats_T* stats = calloc(1, sizeof(hb_allocator_tracking_stats_T));

  return (hb_allocator_T) {
    .alloc = tracking_alloc,
    .dealloc = tracking_dealloc,
    .strdup = tracking_strdup,
    .strndup = tracking_strndup,
    .destroy = tracking_destroy,
    .context = stats,
  };
}

hb_allocator_tracking_stats_T* hb_allocator_tracking_stats(hb_allocator_T* allocator) {
  return (hb_allocator_tracking_stats_T*) allocator->context;
}

// --- High-level API ---

bool hb_allocator_init(hb_allocator_T* allocator, hb_allocator_type_T type) {
  return hb_allocator_init_with_size(allocator, type, 0);
}

bool hb_allocator_init_with_size(hb_allocator_T* allocator, hb_allocator_type_T type, size_t initial_size) {
  switch (type) {
    case HB_ALLOCATOR_MALLOC: {
      *allocator = hb_allocator_with_malloc();
      return true;
    }

    case HB_ALLOCATOR_ARENA: {
      if (initial_size == 0) { initial_size = HB_ALLOCATOR_DEFAULT_ARENA_SIZE; }

      hb_arena_T* arena = malloc(sizeof(hb_arena_T));
      if (!arena) { return false; }

      if (!hb_arena_init(arena, initial_size)) {
        free(arena);
        return false;
      }

      *allocator = hb_allocator_with_arena(arena);
      return true;
    }

    case HB_ALLOCATOR_TRACKING: {
      *allocator = hb_allocator_with_tracking();
      return true;
    }

    default: return false;
  }
}

void hb_allocator_destroy(hb_allocator_T* allocator) {
  allocator->destroy(allocator);
}

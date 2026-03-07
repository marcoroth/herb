#include "include/test.h"
#include "../../src/include/util/hb_allocator.h"

#include <string.h>

TEST(test_malloc_realloc_null_pointer)
  hb_allocator_T allocator = hb_allocator_with_malloc();

  void* pointer = hb_allocator_realloc(&allocator, NULL, 0, 64);
  ck_assert_ptr_nonnull(pointer);

  hb_allocator_dealloc(&allocator, pointer);
END

TEST(test_malloc_realloc_grow)
  hb_allocator_T allocator = hb_allocator_with_malloc();

  char* pointer = hb_allocator_alloc(&allocator, 16);
  ck_assert_ptr_nonnull(pointer);
  memcpy(pointer, "hello, world!!!", 16);

  char* new_pointer = hb_allocator_realloc(&allocator, pointer, 16, 64);
  ck_assert_ptr_nonnull(new_pointer);
  ck_assert_int_eq(memcmp(new_pointer, "hello, world!!!", 16), 0);

  hb_allocator_dealloc(&allocator, new_pointer);
END

TEST(test_malloc_realloc_shrink)
  hb_allocator_T allocator = hb_allocator_with_malloc();

  char* pointer = hb_allocator_alloc(&allocator, 64);
  ck_assert_ptr_nonnull(pointer);
  memcpy(pointer, "shrink me", 10);

  char* new_pointer = hb_allocator_realloc(&allocator, pointer, 64, 16);
  ck_assert_ptr_nonnull(new_pointer);
  ck_assert_int_eq(memcmp(new_pointer, "shrink me", 10), 0);

  hb_allocator_dealloc(&allocator, new_pointer);
END

TEST(test_arena_realloc_null_pointer)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  void* pointer = hb_allocator_realloc(&allocator, NULL, 0, 64);
  ck_assert_ptr_nonnull(pointer);

  hb_allocator_destroy(&allocator);
END

TEST(test_arena_realloc_grow)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* pointer = hb_allocator_alloc(&allocator, 16);
  ck_assert_ptr_nonnull(pointer);
  memcpy(pointer, "hello, world!!!", 16);

  char* new_pointer = hb_allocator_realloc(&allocator, pointer, 16, 64);
  ck_assert_ptr_nonnull(new_pointer);
  ck_assert_ptr_ne(new_pointer, pointer);
  ck_assert_int_eq(memcmp(new_pointer, "hello, world!!!", 16), 0);

  hb_allocator_destroy(&allocator);
END

TEST(test_arena_realloc_shrink)
  hb_allocator_T allocator;
  hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA);

  char* pointer = hb_allocator_alloc(&allocator, 64);
  ck_assert_ptr_nonnull(pointer);
  memcpy(pointer, "shrink me", 10);

  char* new_pointer = hb_allocator_realloc(&allocator, pointer, 64, 16);
  ck_assert_ptr_nonnull(new_pointer);
  ck_assert_int_eq(memcmp(new_pointer, "shrink me", 10), 0);

  hb_allocator_destroy(&allocator);
END

TEST(test_arena_realloc_preserves_data_across_pages)
  hb_allocator_T allocator;
  hb_allocator_init_with_size(&allocator, HB_ALLOCATOR_ARENA, 64);

  char* pointer = hb_allocator_alloc(&allocator, 32);
  ck_assert_ptr_nonnull(pointer);
  memset(pointer, 'A', 32);

  char* new_pointer = hb_allocator_realloc(&allocator, pointer, 32, 128);
  ck_assert_ptr_nonnull(new_pointer);

  for (size_t i = 0; i < 32; i++) {
    ck_assert_int_eq(new_pointer[i], 'A');
  }

  hb_allocator_destroy(&allocator);
END

TEST(test_tracking_realloc_null_pointer)
  hb_allocator_T allocator = hb_allocator_with_tracking();

  void* pointer = hb_allocator_realloc(&allocator, NULL, 0, 64);
  ck_assert_ptr_nonnull(pointer);

  hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);
  ck_assert_int_eq(stats->allocation_count, 1);
  ck_assert_int_eq(stats->bytes_allocated, 64);

  hb_allocator_dealloc(&allocator, pointer);
  hb_allocator_destroy(&allocator);
END

TEST(test_tracking_realloc_grow)
  hb_allocator_T allocator = hb_allocator_with_tracking();

  char* pointer = hb_allocator_alloc(&allocator, 16);
  memcpy(pointer, "hello, world!!!", 16);

  char* new_pointer = hb_allocator_realloc(&allocator, pointer, 16, 64);
  ck_assert_ptr_nonnull(new_pointer);
  ck_assert_int_eq(memcmp(new_pointer, "hello, world!!!", 16), 0);

  hb_allocator_tracking_stats_T* stats = hb_allocator_tracking_stats(&allocator);
  ck_assert_int_eq(stats->allocation_count, 2);
  ck_assert_int_eq(stats->deallocation_count, 1);
  ck_assert_int_eq(stats->bytes_allocated, 16 + 64);
  ck_assert_int_eq(stats->bytes_deallocated, 16);

  hb_allocator_dealloc(&allocator, new_pointer);
  hb_allocator_destroy(&allocator);
END

TCase *hb_allocator_realloc_tests(void) {
  TCase *allocator = tcase_create("Herb Allocator");

  tcase_add_test(allocator, test_malloc_realloc_null_pointer);
  tcase_add_test(allocator, test_malloc_realloc_grow);
  tcase_add_test(allocator, test_malloc_realloc_shrink);

  tcase_add_test(allocator, test_arena_realloc_null_pointer);
  tcase_add_test(allocator, test_arena_realloc_grow);
  tcase_add_test(allocator, test_arena_realloc_shrink);
  tcase_add_test(allocator, test_arena_realloc_preserves_data_across_pages);

  tcase_add_test(allocator, test_tracking_realloc_null_pointer);
  tcase_add_test(allocator, test_tracking_realloc_grow);

  return allocator;
}

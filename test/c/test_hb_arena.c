#include "include/test.h"
#include "../../src/include/util/hb_arena.h"

#include <string.h>

// Test basic allocation
TEST(test_arena_alloc)
  hb_arena_T allocator;

  hb_arena_init(&allocator, 1024);
  ck_assert_ptr_nonnull(allocator.head);
  ck_assert_ptr_eq(allocator.tail, allocator.head);
  ck_assert_int_eq(allocator.default_page_size, 1024);

  {
    char *memory = hb_arena_alloc(&allocator, 1);
    ck_assert_ptr_nonnull(memory);
    *memory = 'a';
    ck_assert_int_eq(*memory, 'a');
  }

  size_t pos = hb_arena_position(&allocator);
  ck_assert(pos % 8 == 0);
  ck_assert_int_eq(pos, 8);

  char *memory = hb_arena_alloc(&allocator, 100);
  ck_assert_ptr_nonnull(memory);
  ck_assert(hb_arena_position(&allocator) % 8 == 0);

  hb_arena_free(&allocator);
END

// Test page growth when allocation exceeds current page
TEST(test_arena_page_growth)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  char *memory1 = hb_arena_alloc(&allocator, 32);
  ck_assert_ptr_nonnull(memory1);
  ck_assert_ptr_eq(allocator.tail, allocator.head);

  char *memory2 = hb_arena_alloc(&allocator, 64);
  ck_assert_ptr_nonnull(memory2);
  ck_assert_ptr_ne(allocator.tail, allocator.head);
  ck_assert_ptr_nonnull(allocator.head->next);

  memset(memory1, 'A', 32);
  memset(memory2, 'B', 64);
  ck_assert_int_eq(memory1[0], 'A');
  ck_assert_int_eq(memory2[0], 'B');

  hb_arena_free(&allocator);
END

// Test large allocation that exceeds default page size
TEST(test_arena_large_allocation)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 1024);

  char *large = hb_arena_alloc(&allocator, 8192);
  ck_assert_ptr_nonnull(large);

  memset(large, 'X', 8192);
  ck_assert_int_eq(large[0], 'X');
  ck_assert_int_eq(large[8191], 'X');

  hb_arena_free(&allocator);
END

// Test reset functionality
TEST(test_arena_reset)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 1024);

  char *memory1 = hb_arena_alloc(&allocator, 100);
  strcpy(memory1, "first");
  size_t position1 = hb_arena_position(&allocator);
  ck_assert_int_eq(position1, 104);

  hb_arena_reset(&allocator);
  ck_assert_int_eq(hb_arena_position(&allocator), 0);
  ck_assert_ptr_eq(allocator.tail, allocator.head);

  char *memory2 = hb_arena_alloc(&allocator, 100);
  ck_assert_ptr_nonnull(memory2);
  strcpy(memory2, "second");
  ck_assert_str_eq(memory2, "second");

  hb_arena_free(&allocator);
END

// Test reset_to functionality
TEST(test_arena_reset_to)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 1024);

  char *memory1 = hb_arena_alloc(&allocator, 100);
  strcpy(memory1, "checkpoint1");
  size_t checkpoint = hb_arena_position(&allocator);
  ck_assert_int_eq(checkpoint, 104);

  char *memory2 = hb_arena_alloc(&allocator, 100);
  strcpy(memory2, "checkpoint2");
  ck_assert_int_eq(hb_arena_position(&allocator), 208);

  hb_arena_reset_to(&allocator, checkpoint);
  ck_assert_int_eq(hb_arena_position(&allocator), checkpoint);

  char *memory3 = hb_arena_alloc(&allocator, 50);
  ck_assert_ptr_nonnull(memory3);
  ck_assert_int_eq(hb_arena_position(&allocator), 160);

  hb_arena_free(&allocator);
END

// Test reset_to with multiple pages
TEST(test_arena_reset_to_multipage)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  hb_arena_alloc(&allocator, 32);
  hb_arena_alloc(&allocator, 32);

  size_t checkpoint = hb_arena_position(&allocator);

  hb_arena_alloc(&allocator, 64);
  ck_assert_ptr_nonnull(allocator.head->next);

  hb_arena_reset_to(&allocator, checkpoint);
  ck_assert_int_eq(hb_arena_position(&allocator), checkpoint);
  ck_assert_ptr_eq(allocator.tail, allocator.head);

  hb_arena_free(&allocator);
END

// Test position tracking across pages
TEST(test_arena_position_multipage)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  ck_assert_int_eq(hb_arena_position(&allocator), 0);

  hb_arena_alloc(&allocator, 32);
  ck_assert_int_eq(hb_arena_position(&allocator), 32);

  hb_arena_alloc(&allocator, 32);
  ck_assert_int_eq(hb_arena_position(&allocator), 64);

  hb_arena_alloc(&allocator, 64);
  ck_assert_int_eq(hb_arena_position(&allocator), 128);

  hb_arena_free(&allocator);
END

// Test capacity calculation
TEST(test_arena_capacity)
  hb_arena_T allocator;

  hb_arena_init(&allocator, 1024);
  ck_assert_int_eq(hb_arena_capacity(&allocator), 1024);

  hb_arena_alloc(&allocator, 100);
  ck_assert_int_eq(hb_arena_capacity(&allocator), 1024);

  hb_arena_alloc(&allocator, 200);
  ck_assert_int_eq(hb_arena_capacity(&allocator), 1024);

  hb_arena_free(&allocator);
END

// Test capacity growth with multiple pages
TEST(test_arena_capacity_multipage)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  size_t initial_capacity = hb_arena_capacity(&allocator);
  ck_assert_int_eq(initial_capacity, 64);

  hb_arena_alloc(&allocator, 32);
  ck_assert_int_eq(hb_arena_capacity(&allocator), 64);

  hb_arena_alloc(&allocator, 64);
  size_t capacity_after_second_page = hb_arena_capacity(&allocator);
  ck_assert_int_eq(capacity_after_second_page, 64 + 64);

  hb_arena_alloc(&allocator, 64);
  size_t capacity_after_third_page = hb_arena_capacity(&allocator);
  ck_assert_int_eq(capacity_after_third_page, 64 + 64 + 64);

  hb_arena_free(&allocator);
END

// Test capacity with large allocation
TEST(test_arena_capacity_large_alloc)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  ck_assert_int_eq(hb_arena_capacity(&allocator), 64);

  hb_arena_alloc(&allocator, 1024);
  size_t new_capacity = hb_arena_capacity(&allocator);

  ck_assert_int_eq(new_capacity, 1024 + 64);

  hb_arena_free(&allocator);
END

// Test capacity doesn't change on reset
TEST(test_arena_capacity_after_reset)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  hb_arena_alloc(&allocator, 64);
  hb_arena_alloc(&allocator, 64);

  size_t capacity_before_reset = hb_arena_capacity(&allocator);
  ck_assert_int_eq(capacity_before_reset, 128);
  ck_assert_int_eq(hb_arena_position(&allocator), 128);

  hb_arena_reset(&allocator);
  ck_assert_int_eq(hb_arena_capacity(&allocator), capacity_before_reset);

  hb_arena_alloc(&allocator, 32);
  size_t checkpoint = hb_arena_position(&allocator);
  ck_assert_int_eq(checkpoint, 32);

  hb_arena_alloc(&allocator, 24);
  ck_assert_int_eq(hb_arena_position(&allocator), 56);

  hb_arena_reset_to(&allocator, checkpoint);
  ck_assert_int_eq(hb_arena_position(&allocator), checkpoint);
  ck_assert_int_eq(hb_arena_capacity(&allocator), capacity_before_reset);

  hb_arena_free(&allocator);
END

// Test free functionality
TEST(test_arena_free)
  hb_arena_T allocator;

  {
    hb_arena_init(&allocator, 1024);
    hb_arena_alloc(&allocator, 100);
    hb_arena_free(&allocator);

    ck_assert_ptr_null(allocator.head);
    ck_assert_ptr_null(allocator.tail);
    ck_assert_int_eq(allocator.default_page_size, 0);
  }

  {
    hb_arena_init(&allocator, 1024);
    hb_arena_free(&allocator);
    hb_arena_free(&allocator);

    ck_assert_ptr_null(allocator.head);
    ck_assert_ptr_null(allocator.tail);
    ck_assert_int_eq(allocator.default_page_size, 0);
  }
END

// Test free with multiple pages
TEST(test_arena_free_multipage)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  hb_arena_alloc(&allocator, 64);
  hb_arena_alloc(&allocator, 64);
  hb_arena_alloc(&allocator, 64);

  ck_assert_ptr_nonnull(allocator.head->next);

  hb_arena_free(&allocator);

  ck_assert_ptr_null(allocator.head);
  ck_assert_ptr_null(allocator.tail);
  ck_assert_int_eq(allocator.default_page_size, 0);
END

// Test alignment
TEST(test_arena_alignment)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 1024);

  for (size_t size = 1; size <= 17; size++) {
    void *ptr = hb_arena_alloc(&allocator, size);
    ck_assert_ptr_nonnull(ptr);
    ck_assert_int_eq((uintptr_t)ptr % 8, 0);
  }

  hb_arena_free(&allocator);
END

// Test page reuse after reset_to
TEST(test_arena_page_reuse_after_reset)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  hb_arena_alloc(&allocator, 32);
  size_t checkpoint = hb_arena_position(&allocator);
  ck_assert_int_eq(checkpoint, 32);

  hb_arena_alloc(&allocator, 64);
  hb_arena_alloc(&allocator, 64);

  size_t capacity_with_three_pages = hb_arena_capacity(&allocator);
  ck_assert_int_eq(capacity_with_three_pages, 192);

  hb_arena_reset_to(&allocator, checkpoint);
  ck_assert_int_eq(hb_arena_position(&allocator), checkpoint);
  ck_assert_ptr_eq(allocator.tail, allocator.head);

  char *memory = hb_arena_alloc(&allocator, 64);
  ck_assert_ptr_nonnull(memory);
  memset(memory, 'R', 64);
  ck_assert_int_eq(memory[0], 'R');

  size_t capacity_after_reuse = hb_arena_capacity(&allocator);
  ck_assert_int_eq(capacity_after_reuse, capacity_with_three_pages);

  hb_arena_free(&allocator);
END

// Test page reuse when next page is too small
TEST(test_arena_page_reuse_when_next_page_is_too_small)
  hb_arena_T allocator;
  hb_arena_init(&allocator, 64);

  hb_arena_alloc(&allocator, 32);
  size_t checkpoint = hb_arena_position(&allocator);

  hb_arena_alloc(&allocator, 16);
  hb_arena_alloc(&allocator, 64);
  hb_arena_alloc(&allocator, 100);

  size_t total_capacity_before = hb_arena_capacity(&allocator);

  hb_arena_reset_to(&allocator, checkpoint);

  char *memory = hb_arena_alloc(&allocator, 80);
  ck_assert_ptr_nonnull(memory);
  memset(memory, 'X', 80);

  size_t total_capacity_after = hb_arena_capacity(&allocator);
  ck_assert_int_eq(total_capacity_after, total_capacity_before);

  char *small = hb_arena_alloc(&allocator, 16);
  ck_assert_ptr_nonnull(small);

  hb_arena_free(&allocator);
END

TCase *hb_arena_tests(void) {
  TCase *arena = tcase_create("arena");

  tcase_add_test(arena, test_arena_alloc);
  tcase_add_test(arena, test_arena_page_growth);
  tcase_add_test(arena, test_arena_large_allocation);
  tcase_add_test(arena, test_arena_reset);
  tcase_add_test(arena, test_arena_reset_to);
  tcase_add_test(arena, test_arena_reset_to_multipage);
  tcase_add_test(arena, test_arena_capacity);
  tcase_add_test(arena, test_arena_capacity_multipage);
  tcase_add_test(arena, test_arena_capacity_large_alloc);
  tcase_add_test(arena, test_arena_capacity_after_reset);
  tcase_add_test(arena, test_arena_position_multipage);
  tcase_add_test(arena, test_arena_free);
  tcase_add_test(arena, test_arena_free_multipage);
  tcase_add_test(arena, test_arena_alignment);
  tcase_add_test(arena, test_arena_page_reuse_after_reset);
  tcase_add_test(arena, test_arena_page_reuse_when_next_page_is_too_small);

  return arena;
}

#include "include/test.h"
#include "../../src/include/util/hb_arena.h"

// Test appending text to buffer
TEST(test_arena_alloc)
  hb_arena_T allocator;

  hb_arena_init(&allocator, 1024);
  ck_assert_int_eq(allocator.position, 0);
  ck_assert_int_eq(allocator.capacity, 1024);

  {
    // Ensure memory is writable
    char *memory = hb_arena_alloc(&allocator, 1);
    *memory = 'a';
  }

  ck_assert(allocator.position % 8 == 0);
  ck_assert_int_eq(allocator.position, 8);

  char *memory = hb_arena_alloc(&allocator, allocator.capacity - allocator.position);
  ck_assert_ptr_nonnull(memory);
  ck_assert(allocator.position % 8 == 0);
END

TEST(test_arena_free)
  hb_arena_T allocator;

  {
    hb_arena_init(&allocator, 1024);
    hb_arena_free(&allocator);

    ck_assert_ptr_null(allocator.memory);
    ck_assert_int_eq(allocator.capacity, 0);
    ck_assert_int_eq(allocator.position, 0);
  }

  {
    hb_arena_init(&allocator, 1024);
    hb_arena_free(&allocator);
    hb_arena_free(&allocator);

    ck_assert_ptr_null(allocator.memory);
    ck_assert_int_eq(allocator.capacity, 0);
    ck_assert_int_eq(allocator.position, 0);
  }
END


TCase *hb_arena_tests(void) {
  TCase *tags = tcase_create("arena");

  tcase_add_test(tags, test_arena_alloc);
  tcase_add_test(tags, test_arena_free);

  return tags;
}

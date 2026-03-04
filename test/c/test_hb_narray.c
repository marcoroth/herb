#include "include/test.h"
#include "../../src/include/util/hb_narray.h"

TEST(test_hb_narray_init)
  hb_narray_T array;

  ck_assert(hb_narray_init(&array, sizeof(uint64_t), 1024));

  ck_assert_int_eq(array.item_size, sizeof(uint64_t));
  ck_assert_int_eq(array.capacity, 1024);
  ck_assert_int_eq(array.size, 0);
  ck_assert_ptr_nonnull(array.items);

  hb_narray_deinit(&array);
END

TEST(test_hb_narray_pointer_init)
  hb_narray_T array;

  ck_assert(hb_narray_pointer_init(&array, 1024));

  ck_assert_int_eq(array.item_size, sizeof(void *));
  ck_assert_int_eq(array.capacity, 1024);
  ck_assert_int_eq(array.size, 0);
  ck_assert_ptr_nonnull(array.items);

  hb_narray_deinit(&array);
END

TEST(test_hb_narray_append)
  hb_narray_T array;

  ck_assert(hb_narray_init(&array, sizeof(uint64_t), 2));

  uint64_t number = 1;
  ck_assert(hb_narray_append(&array, &number));
  ck_assert_int_eq(array.capacity, 2);

  number = 2;
  ck_assert(hb_narray_append(&array, &number));
  ck_assert_int_eq(array.capacity, 2);

  number = 3;
  ck_assert(hb_narray_append(&array, &number));
  ck_assert_int_eq(array.capacity, 4);

  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 0), 1);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 1), 2);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 2), 3);

  ck_assert_int_eq(array.size, 3);

  hb_narray_deinit(&array);
END

TEST(test_hb_narray_first_last)
  hb_narray_T array;

  hb_narray_init(&array, sizeof(uint64_t), 2);

  ck_assert_ptr_null(hb_narray_first(&array));
  ck_assert_ptr_null(hb_narray_last(&array));

  uint64_t number = 1;
  hb_narray_append(&array, &number);

  ck_assert_int_eq(*(uint64_t *)hb_narray_first(&array), 1);
  ck_assert_int_eq(*(uint64_t *)hb_narray_last(&array), 1);

  number = 2;
  hb_narray_append(&array, &number);

  ck_assert_int_eq(*(uint64_t *)hb_narray_first(&array), 1);
  ck_assert_int_eq(*(uint64_t *)hb_narray_last(&array), 2);

  hb_narray_deinit(&array);
END

TEST(test_hb_narray_stack_behavior)
  hb_narray_T array;

  hb_narray_init(&array, sizeof(uint64_t), 2);

  for(uint64_t i = 0; i < 4; i++) {
    hb_narray_push(&array, &i);
  }

  uint64_t number;

  ck_assert(hb_narray_pop(&array, &number));
  ck_assert_int_eq(number, 3);
  ck_assert_int_eq(array.size, 3);

  ck_assert(hb_narray_pop(&array, &number));
  ck_assert_int_eq(number, 2);
  ck_assert_int_eq(array.size, 2);

  ck_assert(hb_narray_pop(&array, &number));
  ck_assert_int_eq(number, 1);
  ck_assert_int_eq(array.size, 1);

  ck_assert(hb_narray_pop(&array, &number));
  ck_assert_int_eq(number, 0);
  ck_assert_int_eq(array.size, 0);

  ck_assert(!hb_narray_pop(&array, &number));

  hb_narray_deinit(&array);
END

TEST(test_hb_narray_remove)
  hb_narray_T array;

  hb_narray_init(&array, sizeof(uint64_t), 2);

  for(uint64_t i = 0; i < 4; i++) {
    hb_narray_push(&array, &i);
  }

  hb_narray_remove(&array, 0);
  ck_assert_int_eq(array.size, 3);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 0), 1);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 1), 2);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 2), 3);

  hb_narray_remove(&array, 1);
  ck_assert_int_eq(array.size, 2);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 0), 1);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 1), 3);

  hb_narray_remove(&array, 1);
  ck_assert_int_eq(array.size, 1);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 0), 1);

  hb_narray_remove(&array, 0);
  ck_assert_int_eq(array.size, 0);

  hb_narray_deinit(&array);
END

// Test hb_narray_size with NULL safety
TEST(test_hb_narray_size)
  ck_assert_int_eq(hb_narray_size(NULL), 0);

  hb_narray_T array;
  hb_narray_init(&array, sizeof(uint64_t), 5);
  ck_assert_int_eq(hb_narray_size(&array), 0);

  uint64_t item1 = 42, item2 = 99;
  hb_narray_append(&array, &item1);
  ck_assert_int_eq(hb_narray_size(&array), 1);

  hb_narray_append(&array, &item2);
  ck_assert_int_eq(hb_narray_size(&array), 2);

  hb_narray_deinit(&array);
END

TEST(test_hb_narray_init_returns_bool)
  hb_narray_T array;

  ck_assert(hb_narray_init(&array, sizeof(uint64_t), 4));
  ck_assert_ptr_nonnull(array.items);
  ck_assert_int_eq(array.size, 0);
  ck_assert_int_eq(array.capacity, 4);

  hb_narray_deinit(&array);
END

TEST(test_hb_narray_append_returns_bool)
  hb_narray_T array;

  ck_assert(hb_narray_init(&array, sizeof(uint64_t), 2));

  uint64_t number = 42;
  ck_assert(hb_narray_append(&array, &number));
  ck_assert_int_eq(array.size, 1);

  number = 43;
  ck_assert(hb_narray_append(&array, &number));
  ck_assert_int_eq(array.size, 2);

  number = 44;
  ck_assert(hb_narray_append(&array, &number));
  ck_assert_int_eq(array.size, 3);
  ck_assert_int_eq(array.capacity, 4);

  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 0), 42);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 1), 43);
  ck_assert_int_eq(*(uint64_t *)hb_narray_get(&array, 2), 44);

  hb_narray_deinit(&array);
END

TCase *hb_narray_tests(void) {
  TCase *buffer = tcase_create("Herb (New) Array");

  tcase_add_test(buffer, test_hb_narray_init);
  tcase_add_test(buffer, test_hb_narray_pointer_init);
  tcase_add_test(buffer, test_hb_narray_append);
  tcase_add_test(buffer, test_hb_narray_first_last);
  tcase_add_test(buffer, test_hb_narray_stack_behavior);
  tcase_add_test(buffer, test_hb_narray_remove);
  tcase_add_test(buffer, test_hb_narray_size);
  tcase_add_test(buffer, test_hb_narray_init_returns_bool);
  tcase_add_test(buffer, test_hb_narray_append_returns_bool);

  return buffer;
}

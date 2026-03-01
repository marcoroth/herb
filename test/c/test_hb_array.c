#include "include/test.h"
#include "../../src/include/util/hb_array.h"

// Test array initialization
TEST(test_hb_array_init)
  hb_array_T* array = hb_array_init(10);

  ck_assert_ptr_nonnull(array);
  ck_assert_int_eq(array->size, 0);
  ck_assert_int_eq(array->capacity, 10);
  ck_assert_ptr_nonnull(array->items);

  hb_array_free(&array);
END

// Test array appending
TEST(test_hb_array_append)
  hb_array_T* array = hb_array_init(2);

  size_t item1 = 42, item2 = 99, item3 = 100;
  hb_array_append(array, &item1);
  hb_array_append(array, &item2);

  ck_assert_int_eq(array->size, 2);
  ck_assert_int_eq(array->capacity, 2);
  ck_assert_ptr_eq(array->items[0], &item1);
  ck_assert_ptr_eq(array->items[1], &item2);

  // Trigger reallocation
  hb_array_append(array, &item3);
  ck_assert_int_eq(array->size, 3);
  ck_assert_int_eq(array->capacity, 4);

  hb_array_free(&array);
END

// Test getting elements
TEST(test_hb_array_get)
  hb_array_T* array = hb_array_init(3);

  size_t item1 = 42, item2 = 99;
  hb_array_append(array, &item1);
  hb_array_append(array, &item2);

  ck_assert_ptr_eq(hb_array_get(array, 0), &item1);
  ck_assert_ptr_eq(hb_array_get(array, 1), &item2);
  ck_assert_ptr_null(hb_array_get(array, 2)); // Out of bounds check

  hb_array_free(&array);
END

// Test setting elements
TEST(test_hb_array_set)
  hb_array_T* array = hb_array_init(3);

  size_t item1 = 42, item2 = 99;
  hb_array_append(array, &item1);
  hb_array_append(array, &item2);

  size_t new_item = 77;
  hb_array_set(array, 1, &new_item);

  ck_assert_ptr_eq(hb_array_get(array, 1), &new_item);

  hb_array_free(&array);
END

// Test removing elements
TEST(test_hb_array_remove)
  hb_array_T* array = hb_array_init(3);

  size_t item1 = 42, item2 = 99, item3 = 100;
  hb_array_append(array, &item1);
  hb_array_append(array, &item2);
  hb_array_append(array, &item3);

  hb_array_remove(array, 1); // Remove item2
  ck_assert_int_eq(array->size, 2);
  ck_assert_ptr_eq(hb_array_get(array, 0), &item1);
  ck_assert_ptr_eq(hb_array_get(array, 1), &item3); // Shifted left

  hb_array_free(&array);
END

// Test freeing the array
TEST(test_hb_array_free)
  hb_array_T* array = hb_array_init(5);
  hb_array_free(&array);

  ck_assert_ptr_null(array);
END

// Test hb_array_size with NULL safety
TEST(test_hb_array_size)
  ck_assert_int_eq(hb_array_size(NULL), 0);

  hb_array_T* array = hb_array_init(5);
  ck_assert_int_eq(hb_array_size(array), 0);

  size_t item1 = 42, item2 = 99;
  hb_array_append(array, &item1);
  ck_assert_int_eq(hb_array_size(array), 1);

  hb_array_append(array, &item2);
  ck_assert_int_eq(hb_array_size(array), 2);

  hb_array_free(&array);
END

// Register test cases
TCase *hb_array_tests(void) {
  TCase *array = tcase_create("Herb Array");

  tcase_add_test(array, test_hb_array_init);
  tcase_add_test(array, test_hb_array_append);
  tcase_add_test(array, test_hb_array_get);
  tcase_add_test(array, test_hb_array_set);
  tcase_add_test(array, test_hb_array_remove);
  tcase_add_test(array, test_hb_array_free);
  tcase_add_test(array, test_hb_array_size);

  return array;
}

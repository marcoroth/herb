#include "include/test.h"
#include "../../src/include/array.h"

// Test array initialization
TEST(test_array_init)
  array_T* array = array_init(10);

  ck_assert_ptr_nonnull(array);
  ck_assert_int_eq(array->size, 0);
  ck_assert_int_eq(array->capacity, 10);
  ck_assert_ptr_nonnull(array->items);

  array_free(&array);
END

// Test array appending
TEST(test_array_append)
  array_T* array = array_init(2);

  size_t item1 = 42, item2 = 99, item3 = 100;
  array_append(array, &item1);
  array_append(array, &item2);

  ck_assert_int_eq(array->size, 2);
  ck_assert_int_eq(array->capacity, 2);
  ck_assert_ptr_eq(array->items[0], &item1);
  ck_assert_ptr_eq(array->items[1], &item2);

  // Trigger reallocation
  array_append(array, &item3);
  ck_assert_int_eq(array->size, 3);
  ck_assert_int_eq(array->capacity, 4);

  array_free(&array);
END

// Test getting elements
TEST(test_array_get)
  array_T* array = array_init(3);

  size_t item1 = 42, item2 = 99;
  array_append(array, &item1);
  array_append(array, &item2);

  ck_assert_ptr_eq(array_get(array, 0), &item1);
  ck_assert_ptr_eq(array_get(array, 1), &item2);
  ck_assert_ptr_null(array_get(array, 2)); // Out of bounds check

  array_free(&array);
END

// Test removing elements
TEST(test_array_remove)
  array_T* array = array_init(3);

  size_t item1 = 42, item2 = 99, item3 = 100;
  array_append(array, &item1);
  array_append(array, &item2);
  array_append(array, &item3);

  array_remove(array, 1); // Remove item2
  ck_assert_int_eq(array->size, 2);
  ck_assert_ptr_eq(array_get(array, 0), &item1);
  ck_assert_ptr_eq(array_get(array, 1), &item3); // Shifted left

  array_free(&array);
END

// Test freeing the array
TEST(test_array_free)
  array_T* array = array_init(5);
  array_free(&array);

  ck_assert_ptr_null(array);
END

// Register test cases
TCase *array_tests(void) {
  TCase *array = tcase_create("Array");

  tcase_add_test(array, test_array_init);
  tcase_add_test(array, test_array_append);
  tcase_add_test(array, test_array_get);
  tcase_add_test(array, test_array_remove);
  tcase_add_test(array, test_array_free);

  return array;
}

#include "include/test.h"
#include "../src/include/buffer.h"

// Test buffer initialization
TEST(test_buffer_init)
  buffer_T buffer;

  ck_assert(buffer_init(&buffer));
  ck_assert_int_eq(buffer.capacity, 1024);
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_ptr_nonnull(buffer.value);
  ck_assert_str_eq(buffer.value, "");

  buffer_free(&buffer);
END

// Test appending text to buffer
TEST(test_buffer_append)
  buffer_T buffer = buffer_new();

  ck_assert_str_eq(buffer.value, "");

  buffer_append(&buffer, "Hello");
  ck_assert_str_eq(buffer.value, "Hello");
  ck_assert_int_eq(buffer.length, 5);

  buffer_append(&buffer, " World");
  ck_assert_str_eq(buffer.value, "Hello World");
  ck_assert_int_eq(buffer.length, 11);

  buffer_free(&buffer);
END

// Test prepending text to buffer
TEST(test_buffer_prepend)
  buffer_T buffer = buffer_new();


  buffer_append(&buffer, "World");
  buffer_prepend(&buffer, "Hello ");
  ck_assert_str_eq(buffer.value, "Hello World");
  ck_assert_int_eq(buffer.length, 11);

  buffer_free(&buffer);
END

// Test concatenating two buffers
TEST(test_buffer_concat)
  buffer_T buffer1 = buffer_new();
  buffer_T buffer2 = buffer_new();

  buffer_append(&buffer1, "Hello");
  buffer_append(&buffer2, " World");

  buffer_concat(&buffer1, &buffer2);
  ck_assert_str_eq(buffer1.value, "Hello World");
  ck_assert_int_eq(buffer1.length, 11);

  buffer_free(&buffer1);
  buffer_free(&buffer2);
END

TEST(test_buffer_increase_capacity)
  buffer_T buffer = buffer_new();

  size_t initial_capacity = buffer.capacity;
  ck_assert_int_ge(initial_capacity, 1024); // Ensure initial capacity is at least 1024

  // Increase capacity by a small amount, should NOT trigger reallocation
  ck_assert(buffer_increase_capacity(&buffer, 100));
  ck_assert_int_eq(buffer.capacity, initial_capacity); // No change expected

  // Increase capacity beyond the current limit, should trigger reallocation
  ck_assert(buffer_increase_capacity(&buffer, initial_capacity + 1));
  ck_assert(buffer.capacity > initial_capacity); // Capacity should increase

  buffer_free(&buffer);
END

// Test buffer reservation (preallocating memory)
TEST(test_buffer_reserve)
  buffer_T buffer = buffer_new();

  ck_assert(buffer_reserve(&buffer, 2048)); // Ensure space for 4096 bytes
  ck_assert_int_eq(buffer.capacity, 4096);

  buffer_free(&buffer);
END

// Test clearing buffer without freeing memory
TEST(test_buffer_clear)
  buffer_T buffer = buffer_new();

  buffer_append(&buffer, "Hello");
  ck_assert_str_eq(buffer.value, "Hello");
  ck_assert_int_eq(buffer.length, 5);
  buffer_clear(&buffer);

  ck_assert_str_eq(buffer.value, "");
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_int_eq(buffer.capacity, 1024); // Capacity should remain unchanged

  buffer_free(&buffer);
END

// Test freeing buffer
TEST(test_buffer_free)
  buffer_T buffer = buffer_new();

  buffer_append(&buffer, "Test");
  ck_assert_int_eq(buffer.length, 4);
  ck_assert_int_eq(buffer.capacity, 1024);
  buffer_free(&buffer);

  ck_assert_ptr_null(buffer.value);
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_int_eq(buffer.capacity, 0);
END

TCase *buffer_tests(void) {
  TCase *buffer = tcase_create("Buffer");

  tcase_add_test(buffer, test_buffer_init);
  tcase_add_test(buffer, test_buffer_append);
  tcase_add_test(buffer, test_buffer_prepend);
  tcase_add_test(buffer, test_buffer_concat);
  tcase_add_test(buffer, test_buffer_increase_capacity);
  tcase_add_test(buffer, test_buffer_reserve);
  tcase_add_test(buffer, test_buffer_clear);
  tcase_add_test(buffer, test_buffer_free);

  return buffer;
}

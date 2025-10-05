#include "include/test.h"
#include "../../src/include/buffer.h"

// Test buffer initialization
TEST(test_buffer_init)
  buffer_T buffer;

  ck_assert(buffer_init(&buffer));
  ck_assert_int_eq(buffer.capacity, 4096);
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_ptr_nonnull(buffer.value);
  ck_assert_str_eq(buffer.value, "");

  buffer_free(&buffer);
END

// Test buffer initialization with custom capacity
TEST(test_buffer_init_with_capacity)
  buffer_T buffer;

  ck_assert(buffer_init_with_capacity(&buffer, 512));
  ck_assert_int_eq(buffer.capacity, 512);
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_ptr_nonnull(buffer.value);
  ck_assert_str_eq(buffer.value, "");

  buffer_free(&buffer);
END

// Test buffer_new_with_capacity
TEST(test_buffer_new_with_capacity)
  buffer_T small_buffer = buffer_new_with_capacity(256);
  ck_assert_int_eq(small_buffer.capacity, 256);
  ck_assert_int_eq(small_buffer.length, 0);
  ck_assert_ptr_nonnull(small_buffer.value);
  ck_assert_str_eq(small_buffer.value, "");
  buffer_free(&small_buffer);

  buffer_T large_buffer = buffer_new_with_capacity(8192);
  ck_assert_int_eq(large_buffer.capacity, 8192);
  ck_assert_int_eq(large_buffer.length, 0);
  ck_assert_ptr_nonnull(large_buffer.value);
  ck_assert_str_eq(large_buffer.value, "");
  buffer_free(&large_buffer);
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

// Test increating
TEST(test_buffer_increase_capacity)
  buffer_T buffer = buffer_new();

  ck_assert_int_eq(buffer.capacity, 4096);

  ck_assert(buffer_increase_capacity(&buffer, 1));
  ck_assert_int_eq(buffer.capacity, 4097);

  ck_assert(buffer_increase_capacity(&buffer, 1024 + 1));
  ck_assert_int_eq(buffer.capacity, 5122);

  buffer_free(&buffer);
END

// Test expanding capacity
TEST(test_buffer_expand_capacity)
  buffer_T buffer = buffer_new();

  ck_assert_int_eq(buffer.capacity, 4096);

  ck_assert(buffer_expand_capacity(&buffer));
  ck_assert_int_eq(buffer.capacity, 8192);

  ck_assert(buffer_expand_capacity(&buffer));
  ck_assert_int_eq(buffer.capacity, 16384);

  ck_assert(buffer_expand_capacity(&buffer));
  ck_assert_int_eq(buffer.capacity, 32768);

  buffer_free(&buffer);
END

// Test expanding if needed
TEST(test_buffer_expand_if_needed)
  buffer_T buffer = buffer_new();

  ck_assert_int_eq(buffer.capacity, 4096);

  ck_assert(buffer_expand_if_needed(&buffer, 1));
  ck_assert_int_eq(buffer.capacity, 4096);

  ck_assert(buffer_expand_if_needed(&buffer, 4095));
  ck_assert_int_eq(buffer.capacity, 4096);

  ck_assert(buffer_expand_if_needed(&buffer, 4096));
  ck_assert_int_eq(buffer.capacity, 4096);

  ck_assert(buffer_expand_if_needed(&buffer, 4097));
  ck_assert_int_eq(buffer.capacity, 12290); // initial capacity (4096) + (required (4097) * 2) = 12290

  buffer_free(&buffer);
END

TEST(test_buffer_expand_if_needed_with_nearly_full_buffer)
  buffer_T buffer = buffer_new();

  ck_assert_int_eq(buffer.capacity, 4096);

  buffer_append_repeated(&buffer, ' ', 4095);
  ck_assert_int_eq(buffer.capacity, 4096);

  ck_assert(buffer_expand_if_needed(&buffer, 2));
  ck_assert_int_eq(buffer.capacity, 8192);

  buffer_free(&buffer);
END

// Test resizing buffer
TEST(test_buffer_resize)
  buffer_T buffer = buffer_new();

  ck_assert_int_eq(buffer.capacity, 4096);

  ck_assert(buffer_resize(&buffer, 8192));
  ck_assert_int_eq(buffer.capacity, 8192);

  ck_assert(buffer_resize(&buffer, 16384));
  ck_assert_int_eq(buffer.capacity, 16384);

  ck_assert(buffer_resize(&buffer, 32768));
  ck_assert_int_eq(buffer.capacity, 32768);

  buffer_free(&buffer);
END

// Test clearing buffer without freeing memory
TEST(test_buffer_clear)
  buffer_T buffer = buffer_new();

  ck_assert_int_eq(buffer.capacity, 4096);

  buffer_append(&buffer, "Hello");
  ck_assert_str_eq(buffer.value, "Hello");
  ck_assert_int_eq(buffer.length, 5);
  ck_assert_int_eq(buffer.capacity, 4096);

  buffer_clear(&buffer);

  ck_assert_str_eq(buffer.value, "");
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_int_eq(buffer.capacity, 4096); // Capacity should remain unchanged

  buffer_free(&buffer);
END

// Test freeing buffer
TEST(test_buffer_free)
  buffer_T buffer = buffer_new();

  buffer_append(&buffer, "Test");
  ck_assert_int_eq(buffer.length, 4);
  ck_assert_int_eq(buffer.capacity, 4096);
  buffer_free(&buffer);

  ck_assert_ptr_null(buffer.value);
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_int_eq(buffer.capacity, 0);
END

// Test buffer UTF-8 integrity
TEST(test_buffer_utf8_integrity)
  buffer_T buffer = buffer_new();

  // UTF-8 String
  const char *utf8_text = "こんにちは";
  buffer_append(&buffer, utf8_text);

  // Ensure length matches actual UTF-8 bytes
  ck_assert_int_eq(buffer.length, strlen(utf8_text));
  ck_assert_int_eq(buffer.length, 15);
  ck_assert_str_eq(buffer.value, utf8_text);

  buffer_free(&buffer);
END

// Test: Buffer Appending UTF-8 Characters
TEST(test_buffer_append_utf8)
  buffer_T buffer = buffer_new();

  // Append UTF-8 string
  buffer_append(&buffer, "こんにちは"); // "Hello" in Japanese
  ck_assert_int_eq(strlen("こんにちは"), 15); // UTF-8 multibyte characters
  ck_assert_int_eq(buffer_length(&buffer), 15);
  ck_assert_str_eq(buffer_value(&buffer), "こんにちは");

  buffer_free(&buffer);
END

// Test buffer length correctness
TEST(test_buffer_length_correctness)
  buffer_T buffer = buffer_new();

  buffer_append(&buffer, "Short");
  size_t length = buffer_length(&buffer);
  ck_assert_int_eq(length, 5);

  buffer_append(&buffer, "er test");
  length = buffer_length(&buffer);
  ck_assert_int_eq(length, 12);

  buffer_free(&buffer);
END

// Test: Buffer Null-Termination
TEST(test_buffer_null_termination)
  buffer_T buffer = buffer_new();

  buffer_append(&buffer, "Test");
  ck_assert(buffer_value(&buffer)[buffer_length(&buffer)] == '\0'); // Ensure null termination

  buffer_free(&buffer);
END

TCase *buffer_tests(void) {
  TCase *buffer = tcase_create("Buffer");

  tcase_add_test(buffer, test_buffer_init);
  tcase_add_test(buffer, test_buffer_init_with_capacity);
  tcase_add_test(buffer, test_buffer_new_with_capacity);
  tcase_add_test(buffer, test_buffer_append);
  tcase_add_test(buffer, test_buffer_prepend);
  tcase_add_test(buffer, test_buffer_concat);
  tcase_add_test(buffer, test_buffer_increase_capacity);
  tcase_add_test(buffer, test_buffer_expand_capacity);
  tcase_add_test(buffer, test_buffer_expand_if_needed);
  tcase_add_test(buffer, test_buffer_expand_if_needed_with_nearly_full_buffer);
  tcase_add_test(buffer, test_buffer_resize);
  tcase_add_test(buffer, test_buffer_clear);
  tcase_add_test(buffer, test_buffer_free);
  tcase_add_test(buffer, test_buffer_utf8_integrity);
  tcase_add_test(buffer, test_buffer_append_utf8);
  tcase_add_test(buffer, test_buffer_length_correctness);
  tcase_add_test(buffer, test_buffer_null_termination);

  return buffer;
}

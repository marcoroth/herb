#include "include/test.h"
#include "../../src/include/buffer.h"

// Test buffer initialization
TEST(test_buffer_init)
  buffer_T buffer;

  ck_assert(buffer_init(&buffer, 1024));
  ck_assert_int_eq(buffer.capacity, 1024);
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_ptr_nonnull(buffer.value);
  ck_assert_str_eq(buffer.value, "");

  free(buffer.value);
END

// Test appending text to buffer
TEST(test_buffer_append)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  ck_assert_str_eq(buffer.value, "");

  buffer_append(&buffer, "Hello");
  ck_assert_str_eq(buffer.value, "Hello");
  ck_assert_int_eq(buffer.length, 5);

  buffer_append(&buffer, " World");
  ck_assert_str_eq(buffer.value, "Hello World");
  ck_assert_int_eq(buffer.length, 11);

  free(buffer.value);
END

// Test expanding if needed
TEST(test_buffer_resize_behavior)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  ck_assert_int_eq(buffer.capacity, 1024);

  buffer_append_char(&buffer, ' ');
  ck_assert_int_eq(buffer.capacity, 1024);

  buffer_append_whitespace(&buffer, 1023);
  ck_assert_int_eq(buffer.capacity, 1024);

  ck_assert_int_eq(buffer.capacity, 1024);

  buffer_append_whitespace(&buffer, 1025);
  ck_assert_int_eq(buffer.capacity, 3074);

  free(buffer.value);
END

TEST(test_buffer_resize_behavior_with_nearly_full_buffer)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  ck_assert_int_eq(buffer.capacity, 1024);

  buffer_append_whitespace(&buffer, 1023);
  ck_assert_int_eq(buffer.capacity, 1024);
  buffer_append_whitespace(&buffer, 2);

  ck_assert_int_eq(buffer.capacity, 2048);

  free(buffer.value);
END

// Test clearing buffer without freeing memory
TEST(test_buffer_clear)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  ck_assert_int_eq(buffer.capacity, 1024);

  buffer_append(&buffer, "Hello");
  ck_assert_str_eq(buffer.value, "Hello");
  ck_assert_int_eq(buffer.length, 5);
  ck_assert_int_eq(buffer.capacity, 1024);

  buffer_clear(&buffer);

  ck_assert_str_eq(buffer.value, "");
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_int_eq(buffer.capacity, 1024); // Capacity should remain unchanged

  free(buffer.value);
END

// Test freeing buffer
TEST(test_buffer_free)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  buffer_append(&buffer, "Test");
  ck_assert_int_eq(buffer.length, 4);
  ck_assert_int_eq(buffer.capacity, 1024);
  free(buffer.value);
  buffer.value = NULL;
  buffer.length = 0;
  buffer.capacity = 0;

  ck_assert_ptr_null(buffer.value);
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_int_eq(buffer.capacity, 0);
END

// Test buffer UTF-8 integrity
TEST(test_buffer_utf8_integrity)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  // UTF-8 String
  const char *utf8_text = "こんにちは";
  buffer_append(&buffer, utf8_text);

  // Ensure length matches actual UTF-8 bytes
  ck_assert_int_eq(buffer.length, strlen(utf8_text));
  ck_assert_int_eq(buffer.length, 15);
  ck_assert_str_eq(buffer.value, utf8_text);

  free(buffer.value);
END

// Test: Buffer Appending UTF-8 Characters
TEST(test_buffer_append_utf8)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  // Append UTF-8 string
  buffer_append(&buffer, "こんにちは"); // "Hello" in Japanese
  ck_assert_int_eq(strlen("こんにちは"), 15); // UTF-8 multibyte characters
  ck_assert_int_eq(buffer_length(&buffer), 15);
  ck_assert_str_eq(buffer_value(&buffer), "こんにちは");

  free(buffer.value);
END

// Test buffer length correctness
TEST(test_buffer_length_correctness)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  buffer_append(&buffer, "Short");
  size_t length = buffer_length(&buffer);
  ck_assert_int_eq(length, 5);

  buffer_append(&buffer, "er test");
  length = buffer_length(&buffer);
  ck_assert_int_eq(length, 12);

  free(buffer.value);
END

// Test: Buffer Null-Termination
TEST(test_buffer_null_termination)
  buffer_T buffer;
  buffer_init(&buffer, 1024);

  buffer_append(&buffer, "Test");
  ck_assert(buffer_value(&buffer)[buffer_length(&buffer)] == '\0'); // Ensure null termination

  free(buffer.value);
END

TCase *buffer_tests(void) {
  TCase *buffer = tcase_create("Buffer");

  tcase_add_test(buffer, test_buffer_init);
  tcase_add_test(buffer, test_buffer_append);
  tcase_add_test(buffer, test_buffer_resize_behavior);
  tcase_add_test(buffer, test_buffer_resize_behavior_with_nearly_full_buffer);
  tcase_add_test(buffer, test_buffer_clear);
  tcase_add_test(buffer, test_buffer_free);
  tcase_add_test(buffer, test_buffer_utf8_integrity);
  tcase_add_test(buffer, test_buffer_append_utf8);
  tcase_add_test(buffer, test_buffer_length_correctness);
  tcase_add_test(buffer, test_buffer_null_termination);

  return buffer;
}

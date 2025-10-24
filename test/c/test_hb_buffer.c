#include "include/test.h"
#include "../../src/include/util/hb_buffer.h"

// Test buffer initialization
TEST(test_hb_buffer_init)
  hb_buffer_T buffer;

  ck_assert(hb_buffer_init(&buffer, 1024));
  ck_assert_int_eq(buffer.capacity, 1024);
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_ptr_nonnull(buffer.value);
  ck_assert_str_eq(buffer.value, "");

  free(buffer.value);
END

// Test appending text to buffer
TEST(test_hb_buffer_append)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  ck_assert_str_eq(buffer.value, "");

  hb_buffer_append(&buffer, "Hello");
  ck_assert_str_eq(buffer.value, "Hello");
  ck_assert_int_eq(buffer.length, 5);

  hb_buffer_append(&buffer, " World");
  ck_assert_str_eq(buffer.value, "Hello World");
  ck_assert_int_eq(buffer.length, 11);

  free(buffer.value);
END

// Test prepending text to buffer
TEST(test_hb_buffer_prepend)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  hb_buffer_append(&buffer, "World");
  hb_buffer_prepend(&buffer, "Hello ");
  ck_assert_str_eq(buffer.value, "Hello World");
  ck_assert_int_eq(buffer.length, 11);

  free(buffer.value);
END

// Test concatenating two buffers
TEST(test_hb_buffer_concat)
  hb_buffer_T buffer1;
  hb_buffer_init(&buffer1, 1024);
  hb_buffer_T buffer2;
  hb_buffer_init(&buffer2, 1024);

  hb_buffer_append(&buffer1, "Hello");
  hb_buffer_append(&buffer2, " World");

  hb_buffer_concat(&buffer1, &buffer2);
  ck_assert_str_eq(buffer1.value, "Hello World");
  ck_assert_int_eq(buffer1.length, 11);

  free(buffer1.value);
  free(buffer2.value);
END

// Test appending a string to the buffer
TEST(test_hb_buffer_append_string)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1);

  hb_buffer_append_string(&buffer, hb_string("Hello, world"));

  ck_assert_str_eq(buffer.value, "Hello, world");
  ck_assert_int_eq(buffer.length, 12);

  free(buffer.value);
END

TEST(test_hb_buffer_resizing_behavior)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  ck_assert_int_eq(buffer.capacity, 1024);

  hb_buffer_append_whitespace(&buffer, 1023);
  ck_assert_int_eq(buffer.capacity, 1024);

  hb_buffer_append_whitespace(&buffer, 2);
  ck_assert_int_eq(buffer.capacity, 2048);

  hb_buffer_append_whitespace(&buffer, 2048);
  ck_assert_int_eq(buffer.capacity, 6144);

  free(buffer.value);
END

// Test clearing buffer without freeing memory
TEST(test_hb_buffer_clear)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  ck_assert_int_eq(buffer.capacity, 1024);

  hb_buffer_append(&buffer, "Hello");
  ck_assert_str_eq(buffer.value, "Hello");
  ck_assert_int_eq(buffer.length, 5);
  ck_assert_int_eq(buffer.capacity, 1024);

  hb_buffer_clear(&buffer);

  ck_assert_str_eq(buffer.value, "");
  ck_assert_int_eq(buffer.length, 0);
  ck_assert_int_eq(buffer.capacity, 1024); // Capacity should remain unchanged

  free(buffer.value);
END

// Test freeing buffer
TEST(test_hb_buffer_free)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  hb_buffer_append(&buffer, "Test");
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
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  // UTF-8 String
  const char *utf8_text = "こんにちは";
  hb_buffer_append(&buffer, utf8_text);

  // Ensure length matches actual UTF-8 bytes
  ck_assert_int_eq(buffer.length, strlen(utf8_text));
  ck_assert_int_eq(buffer.length, 15);
  ck_assert_str_eq(buffer.value, utf8_text);

  free(buffer.value);
END

// Test: Buffer Appending UTF-8 Characters
TEST(test_hb_buffer_append_utf8)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  // Append UTF-8 string
  hb_buffer_append(&buffer, "こんにちは"); // "Hello" in Japanese
  ck_assert_int_eq(strlen("こんにちは"), 15); // UTF-8 multibyte characters
  ck_assert_int_eq(hb_buffer_length(&buffer), 15);
  ck_assert_str_eq(hb_buffer_value(&buffer), "こんにちは");

  free(buffer.value);
END

// Test buffer length correctness
TEST(test_hb_buffer_length_correctness)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  hb_buffer_append(&buffer, "Short");
  size_t length = hb_buffer_length(&buffer);
  ck_assert_int_eq(length, 5);

  hb_buffer_append(&buffer, "er test");
  length = hb_buffer_length(&buffer);
  ck_assert_int_eq(length, 12);

  free(buffer.value);
END

// Test: Buffer Null-Termination
TEST(test_buffer_null_termination)
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 1024);

  hb_buffer_append(&buffer, "Test");
  ck_assert(hb_buffer_value(&buffer)[hb_buffer_length(&buffer)] == '\0'); // Ensure null termination

  free(buffer.value);
END

TCase *hb_buffer_tests(void) {
  TCase *buffer = tcase_create("Herb Buffer");

  tcase_add_test(buffer, test_hb_buffer_init);
  tcase_add_test(buffer, test_hb_buffer_append);
  tcase_add_test(buffer, test_hb_buffer_prepend);
  tcase_add_test(buffer, test_hb_buffer_concat);
  tcase_add_test(buffer, test_hb_buffer_append_string);
  tcase_add_test(buffer, test_hb_buffer_resizing_behavior);
  tcase_add_test(buffer, test_hb_buffer_clear);
  tcase_add_test(buffer, test_hb_buffer_free);
  tcase_add_test(buffer, test_buffer_utf8_integrity);
  tcase_add_test(buffer, test_hb_buffer_append_utf8);
  tcase_add_test(buffer, test_hb_buffer_length_correctness);
  tcase_add_test(buffer, test_buffer_null_termination);

  return buffer;
}

#include <limits.h>

#include "include/test.h"
#include "../../src/include/buffer.h"
#include "../../src/include/json.h"

TEST(test_json_escape_basic)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);
  json_add_string(&json, "key", "value");
  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"key\": \"value\"}");

  free(json.value);
END

TEST(test_json_escape_quotes)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);
  json_add_string(&json, "quote", "This is a \"quoted\" string");
  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"quote\": \"This is a \\\"quoted\\\" string\"}");

  free(json.value);
END

TEST(test_json_escape_backslash)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);
  json_add_string(&json, "path", "C:\\Users\\Test");
  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"path\": \"C:\\\\Users\\\\Test\"}");

  free(json.value);
END

TEST(test_json_escape_newline)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);
  json_add_string(&json, "text", "Line1\nLine2");
  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"text\": \"Line1\\nLine2\"}");

  free(json.value);
END

TEST(test_json_escape_tab)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);
  json_add_string(&json, "text", "Column1\tColumn2");
  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"text\": \"Column1\\tColumn2\"}");

  free(json.value);
END

TEST(test_json_escape_mixed)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);
  json_add_string(&json, "complex", "A \"quoted\" \\ path\nwith\ttabs.");
  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"complex\": \"A \\\"quoted\\\" \\\\ path\\nwith\\ttabs.\"}");

  free(json.value);
END

TEST(test_json_root_object)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);

  json_add_string(&json, "name", "John");
  json_add_int(&json, "age", 20);
  json_add_double(&json, "score", 99.5);
  json_add_bool(&json, "active", 1);

  buffer_T address;
  buffer_init(&address, 1024);
  json_start_object(&json, "address");
  json_add_string(&address, "city", "Basel");
  json_add_string(&address, "country", "Switzerland");
  buffer_concat(&json, &address);
  json_end_object(&json);

  buffer_T languages;
  buffer_init(&languages, 1024);
  json_start_array(&json, "languages");
  json_add_string(&languages, NULL, "Ruby");
  json_add_string(&languages, NULL, "C");
  json_add_string(&languages, NULL, "JavaScript");
  buffer_concat(&json, &languages);
  json_end_array(&json);

  buffer_T ratings;
  buffer_init(&ratings, 1024);
  json_start_array(&json, "ratings");
  json_add_double(&ratings, NULL, 4.5);
  json_add_int(&ratings, NULL, 3);
  json_add_double(&ratings, NULL, 5.0);
  json_add_double(&ratings, NULL, 3.8);
  json_add_int(&ratings, NULL, 5);
  buffer_concat(&json, &ratings);
  json_end_array(&json);

  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"name\": \"John\", \"age\": 20, \"score\": 99.50, \"active\": true, \"address\": {\"city\": \"Basel\", \"country\": \"Switzerland\"}, \"languages\": [\"Ruby\", \"C\", \"JavaScript\"], \"ratings\": [4.50, 3, 5.0, 3.79, 5]}");

  free(address.value);
  free(languages.value);
  free(ratings.value);
  free(json.value);
END

TEST(test_json_root_array)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_array(&json);

  json_add_string(&json, NULL, "Ruby");
  json_add_string(&json, NULL, "C");
  json_add_string(&json, NULL, "JavaScript");
  json_add_int(&json, NULL, 42);
  json_add_double(&json, NULL, 3.14159);
  json_add_bool(&json, NULL, 1);
  json_add_bool(&json, NULL, 0);

  json_end_array(&json);

  ck_assert_str_eq(buffer_value(&json), "[\"Ruby\", \"C\", \"JavaScript\", 42, 3.14, true, false]");

  free(json.value);
END

TEST(test_json_append_array_to_object)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);

  buffer_T object;
  buffer_init(&object, 1024);
  json_start_object(&json, "object");
  json_add_string(&object, "key", "value");

  buffer_T array;
  buffer_init(&array, 1024);
  json_start_array(&object, "array");
  json_add_string(&array, NULL, "One");
  json_add_string(&array, NULL, "Two");

  buffer_concat(&object, &array);
  json_end_array(&object);

  buffer_concat(&json, &object);
  json_end_object(&json);

  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"object\": {\"key\": \"value\", \"array\": [\"One\", \"Two\"]}}");

  free(array.value);
  free(object.value);
  free(json.value);
END

TEST(test_json_append_object_array)
  buffer_T json;
  buffer_init(&json, 1024);

  json_start_root_object(&json);

  buffer_T array;
  buffer_init(&array, 1024);
  json_start_array(&json, "array");
  json_add_string(&array, NULL, "One");
  json_add_string(&array, NULL, "Two");

  buffer_T object;
  buffer_init(&object, 1024);
  json_start_object(&array, NULL);
  json_add_string(&object, "key", "value");

  buffer_concat(&array, &object);
  json_end_object(&array);

  buffer_concat(&json, &array);
  json_end_array(&json);

  json_end_object(&json);

  ck_assert_str_eq(buffer_value(&json), "{\"array\": [\"One\", \"Two\", {\"key\": \"value\"}]}");

  free(object.value);
  free(array.value);
  free(json.value);
END

TEST(test_json_double_to_string_precision)
  char buffer[64];

  json_double_to_string(1.234567890123456, buffer);
  ck_assert_str_eq(buffer, "1.23");

  json_double_to_string(123456.7890123456789, buffer);
  ck_assert_str_eq(buffer, "123456.78");

  json_double_to_string(0.000000000000001, buffer);
  ck_assert_str_eq(buffer, "0.0");

  json_double_to_string(-42.987654321098765, buffer);
  ck_assert_str_eq(buffer, "-42.98");

  json_double_to_string(3.141592653589793, buffer);
  ck_assert_str_eq(buffer, "3.14");
END

TEST(test_json_int_to_string_positive)
  char buffer[20];

  json_int_to_string(12345, buffer);
  ck_assert_str_eq(buffer, "12345");

  json_int_to_string(987654321, buffer);
  ck_assert_str_eq(buffer, "987654321");

  json_int_to_string(0, buffer);
  ck_assert_str_eq(buffer, "0");
END

TEST(test_json_int_to_string_negative)
  char buffer[20];

  json_int_to_string(-1, buffer);
  ck_assert_str_eq(buffer, "-1");

  json_int_to_string(-42, buffer);
  ck_assert_str_eq(buffer, "-42");

  json_int_to_string(-987654321, buffer);
  ck_assert_str_eq(buffer, "-987654321");
END

TEST(test_json_int_to_string_min_max)
  char buffer[20];

  json_int_to_string(2147483647, buffer);
  ck_assert_str_eq(buffer, "2147483647");

  json_int_to_string(-2147483648, buffer);
  ck_assert_str_eq(buffer, "-2147483648");
END

TEST(test_json_add_size_t_basic)
  buffer_T json;
  buffer_init(&json, 1024);

  json_add_size_t(&json, "size", 42);
  ck_assert_str_eq(buffer_value(&json), "\"size\": 42");

  free(json.value);
END

TEST(test_json_add_size_t_large_number)
  buffer_T json;
  buffer_init(&json, 1024);

  json_add_size_t(&json, "size", 9876543210UL);
  ck_assert_str_eq(buffer_value(&json), "\"size\": 9876543210");

  buffer_clear(&json);
  json_add_size_t(&json, "size", SIZE_MAX);
  ck_assert_str_eq(buffer_value(&json), "\"size\": 18446744073709551615");

  free(json.value);
END

TEST(test_json_add_size_t_in_array)
  buffer_T json;
  buffer_init(&json, 1024);

  json_add_size_t(&json, NULL, 1024);
  json_add_size_t(&json, NULL, 2048);
  json_add_size_t(&json, NULL, 4096);

  ck_assert_str_eq(buffer_value(&json), "1024, 2048, 4096");

  free(json.value);
END


TCase* json_tests(void) {
  TCase* json = tcase_create("JSON");

  tcase_add_test(json, test_json_escape_basic);
  tcase_add_test(json, test_json_escape_quotes);
  tcase_add_test(json, test_json_escape_backslash);
  tcase_add_test(json, test_json_escape_tab);
  tcase_add_test(json, test_json_escape_mixed);
  tcase_add_test(json, test_json_root_object);
  tcase_add_test(json, test_json_root_array);
  tcase_add_test(json, test_json_append_array_to_object);
  tcase_add_test(json, test_json_append_object_array);
  tcase_add_test(json, test_json_double_to_string_precision);
  tcase_add_test(json, test_json_int_to_string_positive);
  tcase_add_test(json, test_json_int_to_string_negative);
  tcase_add_test(json, test_json_int_to_string_min_max);
  tcase_add_test(json, test_json_add_size_t_basic);
  tcase_add_test(json, test_json_add_size_t_large_number);
  tcase_add_test(json, test_json_add_size_t_in_array);

  return json;
}

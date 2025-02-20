#include "include/test.h"
#include "../../src/include/json.h"

TEST(test_json_escape_basic)
  JSON* json = json_start_root_object();
  json_add_string(json, "key", "value");
  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"key\": \"value\"}");

  json_free(json);
END

TEST(test_json_escape_quotes)
  JSON* json = json_start_root_object();
  json_add_string(json, "quote", "This is a \"quoted\" string");
  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"quote\": \"This is a \\\"quoted\\\" string\"}");

  json_free(json);
END

TEST(test_json_escape_backslash)
  JSON* json = json_start_root_object();
  json_add_string(json, "path", "C:\\Users\\Test");
  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"path\": \"C:\\\\Users\\\\Test\"}");

  json_free(json);
END

TEST(test_json_escape_newline)
  JSON* json = json_start_root_object();
  json_add_string(json, "text", "Line1\nLine2");
  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"text\": \"Line1\\nLine2\"}");

  json_free(json);
END

TEST(test_json_escape_tab)
  JSON* json = json_start_root_object();
  json_add_string(json, "text", "Column1\tColumn2");
  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"text\": \"Column1\\tColumn2\"}");

  json_free(json);
END

TEST(test_json_escape_mixed)
  JSON* json = json_start_root_object();
  json_add_string(json, "complex", "A \"quoted\" \\ path\nwith\ttabs.");
  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"complex\": \"A \\\"quoted\\\" \\\\ path\\nwith\\ttabs.\"}");

  json_free(json);
END

TEST(test_json_root_object)
  JSON* json = json_start_root_object();

  json_add_string(json, "name", "John");
  json_add_int(json, "age", 20);
  json_add_double(json, "score", 99.5);
  json_add_bool(json, "active", 1);

  JSON* address = json_start_object(json, "address");
  json_add_string(address, "city", "Basel");
  json_add_string(address, "country", "Switzerland");
  json_end_object(json, address);

  JSON* languages = json_start_array(json, "languages");
  json_add_string(languages, NULL, "Ruby");
  json_add_string(languages, NULL, "C");
  json_add_string(languages, NULL, "JavaScript");
  json_end_array(json, languages);

  JSON* ratings = json_start_array(json, "ratings");
  json_add_double(ratings, NULL, 4.5);
  json_add_int(ratings, NULL, 3);
  json_add_double(ratings, NULL, 5.0);
  json_add_double(ratings, NULL, 3.8);
  json_add_int(ratings, NULL, 5);
  json_end_array(json, ratings);

  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"name\": \"John\", \"age\": 20, \"score\": 99.50, \"active\": true, \"address\": {\"city\": \"Basel\", \"country\": \"Switzerland\"}, \"languages\": [\"Ruby\", \"C\", \"JavaScript\"], \"ratings\": [4.50, 3, 5.0, 3.79, 5]}");

  json_free(json);
END

TEST(test_json_root_array)
  JSON* json = json_start_root_array();

  json_add_string(json, NULL, "Ruby");
  json_add_string(json, NULL, "C");
  json_add_string(json, NULL, "JavaScript");
  json_add_int(json, NULL, 42);
  json_add_double(json, NULL, 3.14159);
  json_add_bool(json, NULL, 1);
  json_add_bool(json, NULL, 0);

  json_end_array(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "[\"Ruby\", \"C\", \"JavaScript\", 42, 3.14, true, false]");

  json_free(json);
END

TEST(test_json_append_array_to_object)
  JSON* json = json_start_root_object();

  JSON* object = json_start_object(json, "object");
  json_add_string(object, "key", "value");

  JSON* array = json_start_array(object, "array");
  json_add_string(array, NULL, "One");
  json_add_string(array, NULL, "Two");
  json_end_array(object, array);

  json_end_object(json, object);
  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"object\": {\"key\": \"value\", \"array\": [\"One\", \"Two\"]}}");

  json_free(json);
END

TEST(test_json_append_object_array)
  JSON* json = json_start_root_object();

  JSON* array = json_start_array(json, "array");
  json_add_string(array, NULL, "One");
  json_add_string(array, NULL, "Two");

  JSON* object = json_start_object(array, NULL);
  json_add_string(object, "key", "value");
  json_end_object(array, object);

  json_end_array(json, array);

  json_end_object(NULL, json);

  ck_assert_str_eq(buffer_value(&json->buffer), "{\"array\": [\"One\", \"Two\", {\"key\": \"value\"}]}");

  json_free(json);
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

  return json;
}

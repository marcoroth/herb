#ifndef HERB_STRING_H
#define HERB_STRING_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef struct HB_STRING_STRUCT {
  char* data;
  uint32_t length;
} hb_string_T;

hb_string_T hb_string_from_c_string(const char* null_terminated_c_string);
bool hb_string_equals(hb_string_T a, hb_string_T b);
bool hb_string_equals_case_insensitive(hb_string_T a, hb_string_T b);
bool hb_string_starts_with(hb_string_T string, hb_string_T expected_prefix);
bool hb_string_is_empty(hb_string_T string);

/**
 * @brief Creates a null terminated c string version of the passed string
 *
 * @param string The string for which a c string version is to be created
 * @return A heap allocated null terminated c string
 *
 * Example:
 * @code
 *
 * hb_string_T string = hb_string_from_c_string("Hello, world");
 * char* cstring = hb_string_to_c_string(string);
 *
 * free(cstring);
 * @endcode
 */
char* hb_string_to_c_string(hb_string_T string);

#endif

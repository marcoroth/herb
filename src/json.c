#include "include/json.h"
#include "include/buffer.h"

#include <stdarg.h>
#include <string.h>

void json_escape_string(buffer_T* json, const char* string) {
  if (!string) {
    buffer_append(json, "null");
    return;
  }

  buffer_append(json, "\"");

  while (*string) {
    switch (*string) {
      case '\"': buffer_append(json, "\\\""); break;
      case '\\': buffer_append(json, "\\\\"); break;
      case '\n': buffer_append(json, "\\n"); break;
      case '\t': buffer_append(json, "\\t"); break;
      default: buffer_append_char(json, *string); break;
    }
    string++;
  }

  buffer_append(json, "\"");
}

void json_int_to_string(int value, char* buffer) {
  char string[20]; // Enough to hold all possible int values
  int i = 0;

  // Handle negative numbers
  unsigned int abs_value = (value < 0) ? -(unsigned int) value : value;

  do {
    string[i++] = (char) ((abs_value % 10) + '0');
    abs_value /= 10;
  } while (abs_value > 0);

  if (value < 0) { string[i++] = '-'; }

  int j = 0;

  while (i > 0) {
    buffer[j++] = string[--i];
  }

  buffer[j] = '\0';
}

void json_double_to_string(double value, char* buffer) {
  int int_part = (int) value;
  double frac_part = value - (double) int_part;
  int frac_as_int = (int) (frac_part * 100); // Keep 2 decimal places

  char int_buffer[20];
  char frac_buffer[5];

  json_int_to_string(int_part, int_buffer);
  json_int_to_string(frac_as_int < 0 ? -frac_as_int : frac_as_int, frac_buffer);

  char* pointer = buffer;
  for (const char* source = int_buffer; *source != '\0'; ++source) {
    *pointer++ = *source;
  }

  *pointer++ = '.';

  for (const char* source = frac_buffer; *source != '\0'; ++source) {
    *pointer++ = *source;
  }

  *pointer = '\0';
}

void json_add_string(buffer_T* json, const char* key, const char* value) {
  if (!json) { return; }

  if (json->length > 1) { buffer_append(json, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(json, ": ");
  }

  json_escape_string(json, value);
}

void json_add_double(buffer_T* json, const char* key, double value) {
  if (!json) { return; }

  char number[32];
  json_double_to_string(value, number);

  if (json->length > 1) { buffer_append(json, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(json, ": ");
  }

  buffer_append(json, number);
}

void json_add_int(buffer_T* json, const char* key, int value) {
  if (!json) { return; }

  char number[20];
  json_int_to_string(value, number);

  if (json->length > 1) { buffer_append(json, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(json, ": ");
  }

  buffer_append(json, number);
  if (json->length == 1) { buffer_append(json, " "); }
}

void json_add_size_t(buffer_T* json, const char* key, size_t value) {
  if (!json) { return; }

  char number[32];
  char temp[32];
  int i = 0;

  do {
    temp[i++] = (char) ((value % 10) + '0');
    value /= 10;
  } while (value > 0);

  int j = 0;
  while (i > 0) {
    number[j++] = temp[--i];
  }
  number[j] = '\0';

  if (json->length > 1) { buffer_append(json, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(json, ": ");
  }

  buffer_append(json, number);
  if (json->length == 1) { buffer_append(json, " "); }
}

void json_add_bool(buffer_T* json, const char* key, int value) {
  if (!json) { return; }

  if (json->length > 1) { buffer_append(json, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(json, ": ");
  }

  buffer_append(json, value ? "true" : "false");
}

void json_add_raw_string(buffer_T* json, const char* string) {
  if (!json) { return; }

  if (json->length > 1) { buffer_append(json, ", "); }

  buffer_append(json, string);
}

void json_start_root_object(buffer_T* json) {
  if (json) { buffer_append(json, "{"); }
}

void json_start_object(buffer_T* json, const char* key) {
  if (!json) { return; }

  if (json->length > 1) { buffer_append(json, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(json, ": ");
  }

  buffer_append(json, "{");
}

void json_end_object(buffer_T* json) {
  if (json) { buffer_append(json, "}"); }
}

void json_start_root_array(buffer_T* json) {
  if (json) { buffer_append(json, "["); }
}

void json_start_array(buffer_T* json, const char* key) {
  if (!json) { return; }

  if (json->length > 1) { buffer_append(json, ", "); }
  json_escape_string(json, key);
  buffer_append(json, ": [");
}

void json_end_array(buffer_T* json) {
  if (json) { buffer_append(json, "]"); }
}

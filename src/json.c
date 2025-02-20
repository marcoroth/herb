#include "include/json.h"
#include "include/buffer.h"

#include <stdarg.h>
#include <string.h>

void json_init(JSON* json) {
  json->buffer = buffer_new();
}

void json_free(JSON* json) {
  if (!json) { return; }
  buffer_free(&json->buffer);
  free(json);
}

void json_escape_string(JSON* json, const char* string) {
  if (!string) {
    buffer_append(&json->buffer, "null");
    return;
  }

  buffer_append(&json->buffer, "\"");

  while (*string) {
    switch (*string) {
      case '\"': buffer_append(&json->buffer, "\\\""); break;
      case '\\': buffer_append(&json->buffer, "\\\\"); break;
      case '\n': buffer_append(&json->buffer, "\\n"); break;
      case '\t': buffer_append(&json->buffer, "\\t"); break;
      default: buffer_append_char(&json->buffer, *string); break;
    }
    string++;
  }

  buffer_append(&json->buffer, "\"");
}

static void json_int_to_string(int value, char* buffer) {
  char string[20]; // Enough for an int
  int i = 0, sign = 0;

  if (value < 0) {
    sign = 1;
    value = -value;
  }

  do {
    string[i++] = (char) ((value % 10) + '0');
    value /= 10;
  } while (value > 0);

  if (sign) { string[i++] = '-'; }

  int j = 0;
  while (i > 0) {
    buffer[j++] = string[--i];
  }
  buffer[j] = '\0';
}

static void json_double_to_string(double value, char* buffer) {
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

void json_add_string(JSON* json, const char* key, const char* value) {
  if (!json) { return; }

  if (json->buffer.length > 1) { buffer_append(&json->buffer, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(&json->buffer, ": ");
  }

  json_escape_string(json, value);
}

void json_add_double(JSON* json, const char* key, double value) {
  if (!json) { return; }

  char number[32];
  json_double_to_string(value, number);

  if (json->buffer.length > 1) { buffer_append(&json->buffer, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(&json->buffer, ": ");
  }

  buffer_append(&json->buffer, number);
}

void json_add_int(JSON* json, const char* key, int value) {
  if (!json) { return; }

  char number[20];
  json_int_to_string(value, number);

  if (json->buffer.length > 1) { buffer_append(&json->buffer, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(&json->buffer, ": ");
  }

  buffer_append(&json->buffer, number);
}

void json_add_bool(JSON* json, const char* key, int value) {
  if (!json) { return; }

  if (json->buffer.length > 1) { buffer_append(&json->buffer, ", "); }

  if (key) {
    json_escape_string(json, key);
    buffer_append(&json->buffer, ": ");
  }

  buffer_append(&json->buffer, value ? "true" : "false");
}

JSON* json_start_root_object(void) {
  JSON* object = (JSON*) malloc(sizeof(JSON));
  if (!object) { return NULL; }

  json_init(object);

  buffer_append(&object->buffer, "{");

  return object;
}

JSON* json_start_object(JSON* parent, const char* key) {
  JSON* object = (JSON*) malloc(sizeof(JSON));
  json_init(object);

  if (parent) {
    if (parent->buffer.length > 1) { buffer_append(&parent->buffer, ", "); }

    if (key) {
      json_escape_string(parent, key);
      buffer_append(&parent->buffer, ": ");
    }
  }

  buffer_append(&object->buffer, "{");

  return object;
}

void json_end_object(JSON* parent, JSON* object) {
  if (!object) { return; }

  buffer_append(&object->buffer, "}");

  if (parent) {
    buffer_concat(&parent->buffer, &object->buffer);
    free(object);
  }
}

JSON* json_start_root_array(void) {
  JSON* array = (JSON*) malloc(sizeof(JSON));
  if (!array) { return NULL; }

  json_init(array);
  buffer_append(&array->buffer, "[");
  return array;
}

JSON* json_start_array(JSON* parent, const char* key) {
  if (!parent) { return NULL; }

  if (parent->buffer.length > 1) { buffer_append(&parent->buffer, ", "); }
  json_escape_string(parent, key);
  buffer_append(&parent->buffer, ": [");

  JSON* array = (JSON*) malloc(sizeof(JSON));
  json_init(array);
  return array;
}

void json_end_array(JSON* parent, JSON* array) {
  if (!array) { return; }

  buffer_append(&array->buffer, "]");

  if (parent) {
    buffer_concat(&parent->buffer, &array->buffer);
    json_free(array);
  }
}

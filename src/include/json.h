#ifndef ERBX_JSON_H
#define ERBX_JSON_H

#include "buffer.h"

typedef struct {
  buffer_T buffer;
} JSON;

JSON* json_start_root_object(void);
JSON* json_start_root_array(void);

void json_init(JSON* json);
void json_free(JSON* json);

void json_escape_string(JSON* json, const char* string);

void json_add_string(JSON* json, const char* key, const char* value);
void json_add_int(JSON* json, const char* key, int value);
void json_add_double(JSON* json, const char* key, double value);
void json_add_bool(JSON* json, const char* key, int value);

JSON* json_start_object(JSON* parent, const char* key);
void json_end_object(JSON* parent, JSON* object);

JSON* json_start_array(JSON* parent, const char* key);
void json_end_array(JSON* parent, JSON* array);

void json_double_to_string(double value, char* buffer);
void json_int_to_string(int value, char* buffer);

#endif

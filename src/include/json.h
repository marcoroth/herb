#ifndef ERBX_JSON_H
#define ERBX_JSON_H

#include "buffer.h"

void json_start_root_object(buffer_T* json);
void json_start_root_array(buffer_T* json);

void json_escape_string(buffer_T* json, const char* string);

void json_add_string(buffer_T* json, const char* key, const char* value);
void json_add_int(buffer_T* json, const char* key, int value);
void json_add_double(buffer_T* json, const char* key, double value);
void json_add_bool(buffer_T* json, const char* key, int value);

void json_start_object(buffer_T* json, const char* key);
void json_end_object(buffer_T* json);

void json_start_array(buffer_T* json, const char* key);
void json_end_array(buffer_T* json);

void json_double_to_string(double value, char* buffer);
void json_int_to_string(int value, char* buffer);

#endif

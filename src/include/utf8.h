#ifndef HERB_UTF8_H
#define HERB_UTF8_H

#include <stdbool.h>
#include <stdlib.h>

int utf8_char_byte_length(unsigned char first_byte);
int utf8_sequence_length(const char* str, size_t position, size_t max_length);
bool utf8_is_valid_continuation_byte(unsigned char byte);

#endif

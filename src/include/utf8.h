#ifndef HERB_UTF8_H
#define HERB_UTF8_H

#include "util/hb_string.h"
#include <stdbool.h>
#include <stdlib.h>

uint32_t utf8_char_byte_length(unsigned char first_byte);
uint32_t utf8_sequence_length(hb_string_T value);
bool utf8_is_valid_continuation_byte(unsigned char byte);

#endif

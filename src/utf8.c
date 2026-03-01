#include "include/utf8.h"

// UTF-8 byte patterns:
//   0xxxxxxx = 1 byte (ASCII)
//   110xxxxx = 2 bytes
//   1110xxxx = 3 bytes
//   11110xxx = 4 bytes
uint32_t utf8_char_byte_length(unsigned char first_byte) {
  if ((first_byte & 0x80) == 0) {
    return 1;
  } else if ((first_byte & 0xE0) == 0xC0) {
    return 2;
  } else if ((first_byte & 0xF0) == 0xE0) {
    return 3;
  } else if ((first_byte & 0xF8) == 0xF0) {
    return 4;
  }

  return 1;
}

// Continuation bytes have pattern 10xxxxxx
bool utf8_is_valid_continuation_byte(unsigned char byte) {
  return (byte & 0xC0) == 0x80;
}

uint32_t utf8_sequence_length(const char* str, size_t position, size_t max_length) {
  if (position >= max_length) { return 0; }

  unsigned char first_byte = (unsigned char) str[position];
  uint32_t expected_length = utf8_char_byte_length(first_byte);

  if (position + expected_length > max_length) {
    return 1; // Not enough bytes, treat as single byte
  }

  if (expected_length > 1) {
    for (uint32_t i = 1; i < expected_length; i++) {
      if (!utf8_is_valid_continuation_byte((unsigned char) str[position + i])) {
        return 1; // Invalid continuation byte, treat first byte as single byte
      }
    }
  }

  return expected_length;
}

#include <string.h>
#include "include/test.h"
#include "../../src/include/analyze/action_view/tag_helpers.h"
#include "../../src/include/util/utf8.h"

static const char* position_offset_sources[] = {
  "",
  "a",
  "line1\nline2\n",
  "\n\n\n",
  "\nleading",
  "trailing\n",
  "a\r\nb\r\n\r\nc",
  "lone\rcarriage\r",
  "\xC3\xA9\n\xC3\xBC\xC3\xB1\n\xE6\x97\xA5\xE6\x9C\xAC\xE8\xAA\x9Ex\n",
  "\x80\x80\x61\n\xF0\x9F\x98\x80\x62",
  "<% if x %>\n  <%= \xC3\xA9 %>\n<% end %>",
};

static position_T reference_byte_offset_to_position(const char* source, size_t offset) {
  position_T position = { .line = 1, .column = 1 };

  for (size_t i = 0; i < offset && source[i] != '\0'; i++) {
    if (source[i] == '\n') {
      position.line++;
      position.column = 1;
    } else if (!utf8_is_valid_continuation_byte((unsigned char) source[i])) {
      position.column++;
    }
  }

  return position;
}

static size_t reference_calculate_byte_offset_from_position(const char* source, position_T position) {
  size_t offset = 0;
  uint32_t line = 1;
  uint32_t column = 1;

  while (source[offset] != '\0') {
    if (line == position.line && column == position.column) { return offset; }

    if (source[offset] == '\n') {
      line++;
      column = 1;
    } else if (!utf8_is_valid_continuation_byte((unsigned char) source[offset])) {
      column++;
    }

    offset++;
  }

  return offset;
}

TEST(test_byte_offset_to_position_matches_reference)
  for (size_t index = 0; index < sizeof(position_offset_sources) / sizeof(position_offset_sources[0]); index++) {
    const char* source = position_offset_sources[index];
    size_t length = strlen(source);

    for (size_t offset = 0; offset <= length + 3; offset++) {
      position_T expected = reference_byte_offset_to_position(source, offset);
      position_T actual = byte_offset_to_position(source, offset);

      ck_assert_uint_eq(actual.line, expected.line);
      ck_assert_uint_eq(actual.column, expected.column);
    }
  }
END

TEST(test_calculate_byte_offset_from_position_matches_reference)
  for (size_t index = 0; index < sizeof(position_offset_sources) / sizeof(position_offset_sources[0]); index++) {
    const char* source = position_offset_sources[index];
    uint32_t length = (uint32_t) strlen(source);

    for (uint32_t line = 0; line <= length + 2; line++) {
      for (uint32_t column = 0; column <= length + 3; column++) {
        position_T position = { .line = line, .column = column };

        ck_assert_uint_eq(
          calculate_byte_offset_from_position(source, position),
          reference_calculate_byte_offset_from_position(source, position)
        );
      }
    }
  }
END

TCase *position_offsets_tests(void) {
  TCase *position_offsets = tcase_create("Position Offsets");

  tcase_add_test(position_offsets, test_byte_offset_to_position_matches_reference);
  tcase_add_test(position_offsets, test_calculate_byte_offset_from_position_matches_reference);

  return position_offsets;
}

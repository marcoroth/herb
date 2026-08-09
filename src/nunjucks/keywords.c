#include "../include/nunjucks/keywords.h"

#include <ctype.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

typedef struct {
  const char* keyword;
  const char* replacement;
} nunjucks_keyword_mapping_T;

static const nunjucks_keyword_mapping_T nunjucks_terminators[] = {
  {      "endif", "end" },
  {     "endfor", "end" },
  {   "endblock", "end" },
  {   "endmacro", "end" },
  {  "endfilter", "end" },
  {    "endcall", "end" },
  {     "endset", "end" },
  {     "endraw", "end" },
  { "endverbatim", "end" },
  {    "endeach", "end" },
  {     "endall", "end" },
};

static const nunjucks_keyword_mapping_T nunjucks_iterators[] = {
  { "asyncEach", "for" },
  {  "asyncAll", "for" },
};

static const char* nunjucks_block_openers[] = { "block", "macro", "filter", "call", "raw", "verbatim" };

static bool is_identifier_character(char character) {
  return isalnum((unsigned char) character) || character == '_';
}

static bool keyword_matches(hb_string_T content, uint32_t offset, const char* keyword) {
  size_t length = strlen(keyword);

  if (offset + length > content.length) { return false; }
  if (memcmp(content.data + offset, keyword, length) != 0) { return false; }

  return offset + length == content.length || !is_identifier_character(content.data[offset + length]);
}

static void write_padded(char* buffer, uint32_t offset, const char* replacement, uint32_t keyword_length) {
  size_t replacement_length = strlen(replacement);

  memcpy(buffer + offset, replacement, replacement_length);
  memset(buffer + offset + replacement_length, ' ', keyword_length - replacement_length);
}

static int64_t find_outside_strings(hb_string_T content, uint32_t from, const char* needle) {
  size_t needle_length = strlen(needle);
  char quote = '\0';

  for (uint32_t index = from; index + needle_length <= content.length; index++) {
    char character = content.data[index];

    if (quote != '\0') {
      if (character == '\\') {
        index++;
        continue;
      }

      if (character == quote) { quote = '\0'; }

      continue;
    }

    if (character == '"' || character == '\'') {
      quote = character;
      continue;
    }

    if (memcmp(content.data + index, needle, needle_length) == 0) { return (int64_t) index; }
  }

  return -1;
}

static bool write_begin_in_place(hb_string_T content, char* buffer, uint32_t start, uint32_t end) {
  const uint32_t width = 6; // strlen("begin;")

  uint32_t window_start = start;
  uint32_t window_end = end;

  if (window_end < content.length && isspace((unsigned char) content.data[window_end])) { window_end++; }

  while ((window_end - window_start) < width && window_start > 0
         && isspace((unsigned char) content.data[window_start - 1])) {
    window_start--;
  }

  if ((window_end - window_start) < width) { return false; }

  memcpy(buffer + window_start, "begin;", width);
  memset(buffer + window_start + width, ' ', (window_end - window_start) - width);

  return true;
}

static hb_string_T normalize(hb_string_T content, hb_allocator_T* allocator, bool allow_growth) {
  if (hb_string_is_null(content) || content.length == 0) { return content; }

  uint32_t start = 0;

  while (start < content.length && isspace((unsigned char) content.data[start])) {
    start++;
  }

  if (start == content.length) { return content; }

  uint32_t end = start;

  while (end < content.length && is_identifier_character(content.data[end])) {
    end++;
  }

  if (end == start) { return content; }

  uint32_t keyword_length = end - start;
  char* buffer = hb_allocator_alloc(allocator, content.length + 3);

  if (!buffer) { return content; }

  memcpy(buffer, content.data, content.length);

  uint32_t length = content.length;
  bool changed = false;

  if (!allow_growth) {
    static const char* raw_markers[] = { "raw", "verbatim", "endraw", "endverbatim" };

    for (size_t index = 0; index < sizeof(raw_markers) / sizeof(raw_markers[0]); index++) {
      if (keyword_matches(content, start, raw_markers[index])) {
        memset(buffer + start, ' ', keyword_length);

        return hb_string_from_data(buffer, length);
      }
    }
  }

  for (size_t index = 0; index < sizeof(nunjucks_terminators) / sizeof(nunjucks_terminators[0]); index++) {
    if (keyword_matches(content, start, nunjucks_terminators[index].keyword)) {
      write_padded(buffer, start, nunjucks_terminators[index].replacement, keyword_length);
      changed = true;
      break;
    }
  }

  if (!changed) {
    for (size_t index = 0; index < sizeof(nunjucks_iterators) / sizeof(nunjucks_iterators[0]); index++) {
      if (keyword_matches(content, start, nunjucks_iterators[index].keyword)) {
        write_padded(buffer, start, nunjucks_iterators[index].replacement, keyword_length);
        changed = true;
        break;
      }
    }
  }

  if (!changed && keyword_matches(content, start, "elif") && start > 0) {
    memcpy(buffer + start - 1, "elsif", 5);
    changed = true;
  }

  if (!changed && keyword_matches(content, start, "import")) {
    int64_t offset = find_outside_strings(content, end, " as ");

    if (offset >= 0) {
      memcpy(buffer + offset, ",as:", 4);
      changed = true;
    }
  }

  if (!changed && keyword_matches(content, start, "from")) {
    int64_t offset = find_outside_strings(content, end, " import ");

    if (offset >= 0) {
      memcpy(buffer + offset, ",import:", 8);
      changed = true;
    }
  }

  bool opens_block = false;

  for (size_t index = 0; index < sizeof(nunjucks_block_openers) / sizeof(nunjucks_block_openers[0]); index++) {
    if (keyword_matches(content, start, nunjucks_block_openers[index])) {
      opens_block = true;
      break;
    }
  }

  if (!opens_block && keyword_matches(content, start, "set")) {
    opens_block = (find_outside_strings(content, end, "=") < 0);
  }

  if (opens_block) {
    if (allow_growth) {
      memcpy(buffer + length, " do", 3);
      length += 3;
      changed = true;
    } else if (write_begin_in_place(content, buffer, start, end)) {
      changed = true;
    }
  }

  if (!changed) { return content; }

  return hb_string_from_data(buffer, length);
}

hb_string_T nunjucks_statement_keyword(hb_string_T content) {
  if (hb_string_is_null(content)) { return HB_STRING_EMPTY; }

  uint32_t start = 0;

  while (start < content.length && isspace((unsigned char) content.data[start])) {
    start++;
  }

  uint32_t end = start;

  while (end < content.length && is_identifier_character(content.data[end])) {
    end++;
  }

  return hb_string_range(content, start, end);
}

hb_string_T nunjucks_normalize_statement(hb_string_T content, hb_allocator_T* allocator) {
  return normalize(content, allocator, true);
}

hb_string_T nunjucks_normalize_statement_fixed_width(hb_string_T content, hb_allocator_T* allocator) {
  return normalize(content, allocator, false);
}

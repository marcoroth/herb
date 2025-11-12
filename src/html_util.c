#include "include/html_util.h"
#include "include/util.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"

#include <ctype.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

// https://developer.mozilla.org/en-US/docs/Glossary/Void_element
bool is_void_element(hb_string_T tag_name) {
  if (hb_string_is_empty(tag_name)) { return false; }

  hb_string_T void_tags[14] = {
    hb_string("area"),  hb_string("base"),   hb_string("br"),    hb_string("col"),  hb_string("embed"),
    hb_string("hr"),    hb_string("img"),    hb_string("input"), hb_string("link"), hb_string("meta"),
    hb_string("param"), hb_string("source"), hb_string("track"), hb_string("wbr"),
  };

  for (size_t i = 0; i < 14; i++) {
    if (hb_string_equals_case_insensitive(tag_name, void_tags[i])) { return true; }
  }

  return false;
}

/**
 * @brief Creates a closing HTML tag string like "</tag_name>"
 *
 * @param tag_name The name of the HTML tag to be enclosed in a closing tag
 * @return A newly allocated string containing the closing tag, or NULL if memory allocation fails
 * @note The caller is responsible for freeing the returned string
 *
 * Example:
 * @code
 * hb_string_T tag = html_closing_tag_string(hb_string("div"));
 *
 * printf("%.*s\n", tag.length, tag.data); // Prints: </div>
 * free(tag.data);
 * @endcode
 */
hb_string_T html_closing_tag_string(hb_string_T tag_name) {
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, tag_name.length + 3);

  hb_buffer_append_char(&buffer, '<');
  hb_buffer_append_char(&buffer, '/');
  hb_buffer_append_string(&buffer, tag_name);
  hb_buffer_append_char(&buffer, '>');

  return hb_string(buffer.value);
}

/**
 * @brief Creates a self-closing HTML tag string like "<tag_name />"
 *
 * @param tag_name The name of the HTML tag to be enclosed in a self-closing tag
 * @return A newly allocated string containing the self-closing tag, or NULL if memory allocation fails
 * @note The caller is responsible for freeing the returned string
 *
 * Example:
 * @code
 * hb_string_T tag = html_self_closing_tag_string(hb_string("br"));
 * printf("%.*s\n", tag.length, tag.data); // Prints: <br />
 * free(tag);
 * @endcode
 */
hb_string_T html_self_closing_tag_string(hb_string_T tag_name) {
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, tag_name.length + 4);

  hb_buffer_append_char(&buffer, '<');
  hb_buffer_append_string(&buffer, tag_name);
  hb_buffer_append_char(&buffer, ' ');
  hb_buffer_append_char(&buffer, '/');
  hb_buffer_append_char(&buffer, '>');

  return hb_string(buffer.value);
}

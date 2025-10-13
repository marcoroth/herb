#include "include/html_util.h"
#include "include/buffer.h"
#include "include/util.h"

#include <ctype.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>

// https://developer.mozilla.org/en-US/docs/Glossary/Void_element
bool is_void_element(const char* tag_name) {
  if (tag_name == NULL) { return false; }

  const char* void_tags[] = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
  };

  for (size_t i = 0; i < sizeof(void_tags) / sizeof(char*); i++) {
    if (strcasecmp(tag_name, void_tags[i]) == 0) { return true; }
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
 * char* tag = html_closing_tag_string("div");
 * if (tag) {
 *   printf("%s\n", tag); // Prints: </div>
 *   free(tag);
 * }
 * @endcode
 */
char* html_closing_tag_string(const char* tag_name) {
  if (tag_name == NULL) { return herb_strdup("</>"); }

  buffer_T buffer;
  buffer_init(&buffer, strlen(tag_name) + 3);

  buffer_append_char(&buffer, '<');
  buffer_append_char(&buffer, '/');
  buffer_append(&buffer, tag_name);
  buffer_append_char(&buffer, '>');

  return buffer.value;
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
 * char* tag = html_self_closing_tag_string("br");
 * if (tag) {
 *   printf("%s\n", tag); // Prints: <br />
 *   free(tag);
 * }
 * @endcode
 */
char* html_self_closing_tag_string(const char* tag_name) {
  if (tag_name == NULL) { return herb_strdup("< />"); }

  buffer_T buffer;
  buffer_init(&buffer, strlen(tag_name) + 4);

  buffer_append_char(&buffer, '<');
  buffer_append(&buffer, tag_name);
  buffer_append_char(&buffer, ' ');
  buffer_append_char(&buffer, '/');
  buffer_append_char(&buffer, '>');

  return buffer.value;
}

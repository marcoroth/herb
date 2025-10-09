#include "include/html_util.h"
#include "include/memory_arena.h"
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

bool is_html4_void_element(const char* tag_name) {
  if (tag_name == NULL) { return false; }

  const char* html4_void_tags[] = {
    "basefont", "bgsound", "command", "frame", "image", "keygen",
  };

  for (size_t i = 0; i < sizeof(html4_void_tags) / sizeof(char*); i++) {
    if (strcasecmp(tag_name, html4_void_tags[i]) == 0) { return true; }
  }

  return false;
}

/**
 * @brief Creates an opening HTML tag string like "<tag_name>"
 *
 * @param tag_name The name of the HTML tag to be enclosed in a opening tag
 * @return A newly allocated string containing the opening tag, or NULL if memory allocation fails
 * @note The caller is responsible for freeing the returned string
 *
 * Example:
 * @code
 * char* tag = html_opening_tag_string("div");
 * if (tag) {
 *   printf("%s\n", tag); // Prints: <div>
 *   free(tag);
 * }
 * @endcode
 */
char* html_opening_tag_string(arena_allocator_T* allocator, const char* tag_name) {
  if (tag_name == NULL) { return herb_strdup("<>"); }

  size_t length = strlen(tag_name);
  char* result = (char*) arena_alloc(allocator, length + 3); // +3 for '<', '>', and '\0'

  if (result == NULL) { return NULL; }

  result[0] = '<';

  memcpy(result + 1, tag_name, length);

  result[length + 1] = '>';
  result[length + 2] = '\0';

  return result;
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
char* html_closing_tag_string(arena_allocator_T* allocator, const char* tag_name) {
  if (tag_name == NULL) { return herb_strdup("</>"); }

  size_t length = strlen(tag_name);
  char* result = (char*) arena_alloc(allocator, length + 4); // +4 for '<', '/', '>', and '\0'

  if (result == NULL) { return NULL; }

  result[0] = '<';
  result[1] = '/';

  memcpy(result + 2, tag_name, length);

  result[length + 2] = '>';
  result[length + 3] = '\0';

  return result;
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
char* html_self_closing_tag_string(arena_allocator_T* allocator, const char* tag_name) {
  if (tag_name == NULL) { return herb_strdup("< />"); }

  size_t length = strlen(tag_name);
  char* result = (char*) arena_alloc(allocator, length + 5); // +5 for '<', ' ', '/', '>', and '\0'

  if (result == NULL) { return NULL; }

  result[0] = '<';

  memcpy(result + 1, tag_name, length);

  result[length + 1] = ' ';
  result[length + 2] = '/';
  result[length + 3] = '>';
  result[length + 4] = '\0';

  return result;
}

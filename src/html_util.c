#include "include/html_util.h"

#include <ctype.h>
#include <stdbool.h>
#include <strings.h>

// https://developer.mozilla.org/en-US/docs/Glossary/Void_element
bool is_void_element(const char* tagName) {
  const char* void_tags[] =
      {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"};

  for (size_t i = 0; i < sizeof(void_tags) / sizeof(char*); i++) {
    if (strcasecmp(tagName, void_tags[i]) == 0) {
      return true;
    }
  }

  return false;
}

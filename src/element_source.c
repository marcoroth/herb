#include "include/element_source.h"

const char* element_source_to_string(element_source_t source) {
  switch (source) {
    case ELEMENT_SOURCE_HTML: return "HTML";
    case ELEMENT_SOURCE_ACTIONVIEW: return "ActionView";
    case ELEMENT_SOURCE_HAML: return "Haml";
    case ELEMENT_SOURCE_SLIM: return "Slim";
    default: return "Unknown";
  }
}

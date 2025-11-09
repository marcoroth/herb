#include "include/element_source.h"
#include "include/util/hb_string.h"

hb_string_T element_source_to_string(element_source_t source) {
  switch (source) {
    case ELEMENT_SOURCE_HTML: return hb_string("HTML");
    case ELEMENT_SOURCE_ACTIONVIEW: return hb_string("ActionView");
    case ELEMENT_SOURCE_HAML: return hb_string("Haml");
    case ELEMENT_SOURCE_SLIM: return hb_string("Slim");
    default: return hb_string("Unknown");
  }
}

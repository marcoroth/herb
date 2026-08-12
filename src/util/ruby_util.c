#include "../include/util/ruby_util.h"
#include "../include/lib/hb_string.h"

#include <stdbool.h>
#include <stddef.h>

static hb_string_T ruby_introspection_methods[] = HB_STRING_LIST(
  "send",
  "public_send",
  "__send__",
  "try",
  "try!",
  "method",
  "class",
  "inspect",
  "to_s",
  "object_id",
  "__id__",
  "dup",
  "clone",
  "freeze",
  "frozen",
  "tap",
  "then",
  "yield_self"
);

bool is_ruby_introspection_method(hb_string_T method_name) {
  size_t count = sizeof(ruby_introspection_methods) / sizeof(ruby_introspection_methods[0]);

  for (size_t index = 0; index < count; index++) {
    if (hb_string_equals(method_name, ruby_introspection_methods[index])) { return true; }
  }

  if (method_name.length > 0) {
    char last_char = method_name.data[method_name.length - 1];

    if (last_char == '?' || last_char == '!') { return true; }
  }

  return false;
}

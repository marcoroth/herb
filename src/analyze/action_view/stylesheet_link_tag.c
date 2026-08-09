#include "../../include/lib/hb_allocator.h"
#include "../../include/lib/hb_buffer.h"

#include <prism.h>
#include <stdbool.h>
#include <string.h>

bool stylesheet_link_tag_source_is_url(const char* source, size_t length) {
  if (!source || length == 0) { return false; }

  if (length >= 2 && source[0] == '/' && source[1] == '/') { return true; }
  if (strstr(source, "://") != NULL) { return true; }

  return false;
}

char* wrap_in_stylesheet_path(
  const char* source,
  size_t source_length,
  const char* path_options,
  hb_allocator_T* allocator
) {
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, source_length + 32, allocator);

  hb_buffer_append(&buffer, "stylesheet_path(");
  hb_buffer_append_with_length(&buffer, source, source_length);

  if (path_options && strlen(path_options) > 0) {
    hb_buffer_append(&buffer, ", ");
    hb_buffer_append(&buffer, path_options);
  }

  hb_buffer_append(&buffer, ")");

  char* result = hb_allocator_strdup(allocator, hb_buffer_value(&buffer));
  hb_buffer_free(&buffer);

  return result;
}

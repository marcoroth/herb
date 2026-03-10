#ifndef HERB_ELEMENT_SOURCE_H
#define HERB_ELEMENT_SOURCE_H

typedef enum {
  ELEMENT_SOURCE_HTML,
  ELEMENT_SOURCE_ACTIONVIEW,
  ELEMENT_SOURCE_HAML,
  ELEMENT_SOURCE_SLIM
} element_source_t;

const char* element_source_to_string(element_source_t source);

#endif

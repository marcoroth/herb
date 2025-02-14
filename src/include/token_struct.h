#ifndef ERBX_TOKEN_STRUCT_H
#define ERBX_TOKEN_STRUCT_H

#include "location.h"
#include "range.h"

typedef enum {
  TOKEN_WHITESPACE,
  TOKEN_NEWLINE,
  TOKEN_TEXT_CONTENT,

  TOKEN_HTML_DOCTYPE,

  TOKEN_HTML_TAG_NAME,
  TOKEN_HTML_TAG_START,       // <
  TOKEN_HTML_TAG_END,         // >
  TOKEN_HTML_CLOSE_TAG_START, // </
  TOKEN_HTML_TAG_SELF_CLOSE,  // />

  TOKEN_HTML_COMMENT_START,
  TOKEN_HTML_COMMENT_CONTENT,
  TOKEN_HTML_COMMENT_END,

  TOKEN_HTML_ATTRIBUTE_NAME,
  TOKEN_HTML_ATTRIBUTE_VALUE,

  TOKEN_HTML_EQUALS,
  TOKEN_HTML_QUOTE,

  TOKEN_ERB_START,
  TOKEN_ERB_CONTENT,
  TOKEN_ERB_END,

  TOKEN_EOF,
} token_type_T;

typedef struct TOKEN_STRUCT {
  char* value;
  range_T* range;
  location_T* start;
  location_T* end;
  token_type_T type;
} token_T;

#endif

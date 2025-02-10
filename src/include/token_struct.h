#ifndef ERBX_TOKEN_STRUCT_H
#define ERBX_TOKEN_STRUCT_H

#include <stdlib.h>

#include "location.h"
#include "range.h"

typedef struct TOKEN_STRUCT {
  char *value;
  range_T *range;
  location_T *start;
  location_T *end;
  enum {
    TOKEN_ATTRIBUTE_NAME,
    TOKEN_ATTRIBUTE_VALUE,
    TOKEN_DOUBLE_QUOTE,
    TOKEN_END_TAG_END,
    TOKEN_END_TAG_START,
    TOKEN_EOF,
    TOKEN_EQUALS,
    TOKEN_ID,
    TOKEN_NEWLINE,
    TOKEN_SINGLE_QUOTE,
    TOKEN_SPACE,
    TOKEN_START_TAG_END_VOID,
    TOKEN_START_TAG_END,
    TOKEN_START_TAG_START,
    TOKEN_TAG_END,
    TOKEN_TAG_NAME,
    TOKEN_TEXT_CONTENT,
    TOKEN_WHITESPACE,
  } type;
} token_T;

#endif

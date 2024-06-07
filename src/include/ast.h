#ifndef ERBX_AST_H
#define ERBX_AST_H

#include "list.h"

typedef struct AST_STRUCT {
  enum {
    AST_ELEMENT,
    AST_ATTRIBUTE,
    AST_ATTRIBUTE_NAME,
    AST_ATTRIBUTE_VALUE,
    AST_TEXT_CONTENT,
    AST_ERB_LOUD,
    AST_ERB_SILENT,
    AST_ERB_RAW,
    AST_ERB_LOUD_BLOCK,
    AST_NOOP,
  } type;

  list_T* children;
  char* name;
  struct AST_STRUCT* value;
  int data_type;
  int int_value;
} AST_T;

AST_T* ast_init(int type);

#endif

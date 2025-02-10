#include "include/ast.h"

#include <stdlib.h>

size_t ast_sizeof(void) {
  return sizeof(struct AST_STRUCT);
}

AST_T* ast_init(int type) {
  AST_T* ast = calloc(1, ast_sizeof());
  ast->type = type;
  ast->children = array_init(ast_sizeof());

  return ast;
}

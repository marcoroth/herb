#include "include/ast.h"

#include <stdlib.h>

AST_T* ast_init(int type) {
  AST_T* ast = calloc(1, sizeof(struct AST_STRUCT));
  ast->type = type;
  ast->children = array_init(sizeof(struct AST_STRUCT));

  return ast;
}

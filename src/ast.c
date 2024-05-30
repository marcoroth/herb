#include "include/ast.h"

#include <stdlib.h>

AST_T* init_ast(int type) {
  AST_T* ast = calloc(1, sizeof(struct AST_STRUCT));
  ast->type = type;
  ast->children = init_list(sizeof(struct AST_STRUCT));

  return ast;
}

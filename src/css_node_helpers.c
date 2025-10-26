#include "include/css_node_helpers.h"
#include "include/ast_nodes.h"
#include "include/css_parser.h"
#include "include/util.h"
#include "include/util/hb_array.h"

#include <stdlib.h>
#include <string.h>

AST_CSS_STYLE_NODE_T* create_css_style_node(
  const char* css_content,
  position_T start_position,
  position_T end_position
) {
  if (!css_content) {
    return ast_css_style_node_init(
      "",
      hb_array_init(0),
      false,
      "No CSS content provided",
      start_position,
      end_position,
      hb_array_init(0)
    );
  }

  struct css_parse_result_T* result = herb_css_parse(css_content);

  if (!result) {
    return ast_css_style_node_init(
      css_content,
      hb_array_init(0),
      false,
      "Failed to parse CSS",
      start_position,
      end_position,
      hb_array_init(0)
    );
  }

  AST_CSS_STYLE_NODE_T* node;

  if (result->success) {
    hb_array_T* rules = hb_array_init(result->rule_count);

    for (size_t i = 0; i < result->rule_count; i++) {
      struct CSSRule* css_rule = result->rules[i];

      hb_array_T* declarations = hb_array_init(css_rule->declaration_count);

      for (size_t j = 0; j < css_rule->declaration_count; j++) {
        struct CSSDeclaration* css_decl = css_rule->declarations[j];

        AST_CSS_DECLARATION_NODE_T* decl_node = ast_css_declaration_node_init(
          herb_strdup(css_decl->property),
          herb_strdup(css_decl->value),
          start_position,
          end_position,
          hb_array_init(0)
        );

        hb_array_append(declarations, decl_node);
      }

      AST_CSS_RULE_NODE_T* rule_node = ast_css_rule_node_init(
        herb_strdup(css_rule->selector),
        declarations,
        start_position,
        end_position,
        hb_array_init(0)
      );

      hb_array_append(rules, rule_node);
    }

    node = ast_css_style_node_init(
      herb_strdup(css_content),
      rules,
      true,
      "",
      start_position,
      end_position,
      hb_array_init(0)
    );
  } else {
    node = ast_css_style_node_init(
      herb_strdup(css_content),
      hb_array_init(0),
      false,
      result->error_message ? herb_strdup(result->error_message) : herb_strdup("Unknown CSS parse error"),
      start_position,
      end_position,
      hb_array_init(0)
    );
  }

  herb_css_free_result(result);

  return node;
}

#include "include/analyze.h"
#include "include/array.h"
#include "include/ast_nodes.h"
#include "include/errors.h"
#include "include/location.h"
#include "include/parser.h"
#include "include/position.h"
#include "include/ruby_parser.h"
#include "include/visitor.h"

// #include "/Users/marcoroth/Development/herb/vendor/bundle/ruby/3.4.0/bundler/gems/prism-01843caefd06/include/prism.h"
#include <prism.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char* pm_error_level_to_string(pm_error_level_t level) {
  switch (level) {
    case PM_ERROR_LEVEL_SYNTAX: return "syntax";
    case PM_ERROR_LEVEL_ARGUMENT: return "argument";
    case PM_ERROR_LEVEL_LOAD: return "load";
    default: return "Unknown pm_error_level_t";
  }
}

static RUBY_PARSE_ERROR_T* ruby_parse_error_from_prism_error(const pm_diagnostic_t* error, const AST_NODE_T* node) {
  return ruby_parse_error_init(
    error->message,
    pm_diagnostic_id_human(error->diag_id),
    error->level,
    pm_error_level_to_string(error->level),
    node->location->start,
    node->location->end
  );
}

// for a document like this:
//
// <h1>
//   <% if true %>
//     Hello 1
//   <% elsif true && false %>
//     Hello 2
//   <% else %>
//     Hello 3
//   <% end %>
// </h1>
//
// have this structure in the three as:
//
// AST_DOCUMENT_NODE
//   AST_ELEMENT_NODE
//     |-> children:
//       - AST_ERB_CONTENT_NODE (if true)
//       - AST_HTML_TEXT_NODE (Hello 1)
//       - AST_ERB_CONTENT_NODE (elsif true && false)
//       - AST_HTML_TEXT_NODE (Hello 2)
//       - AST_ERB_CONTENT_NODE (else)
//       - AST_HTML_TEXT_NODE (Hello 3)
//       - AST_ERB_CONTENT_NODE (end)

// but it should be something like
//
// AST_DOCUMENT_NODE
//   AST_ELEMENT_NODE
//   |-> children:
//     - AST_ERB_IF_NODE
//       |-> predicate: true
//       |-> children: [
//         - AST_HTML_TEXT_NODE (Hello 1)
//       ]
//       |-> subsequent:
//           |-> AST_ERB_IF_NODE
//               |-> predicate: true && false
//               |-> children: [
//                 - AST_HTML_TEXT_NODE (Hello 2)
//               ]
//              |-> subsequent:
//                |-> AST_ERB_ELSE_NODE
//                   |-> children: [
//                    - AST_HTML_TEXT_NODE (Hello 3)
//                  ]
//
//
//
// so what we want to achieve is to group any ERB content nodes that are part of an if, elsif, else, or end block
// into a single node that represents that block. This will make it easier to analyze the structure of the ERB content
//

static analyzed_ruby_T* init_analyzed_ruby_T(char* source) {
  analyzed_ruby_T* analyzed = malloc(sizeof(analyzed_ruby_T));

  pm_parser_init(&analyzed->parser, (const uint8_t*) source, strlen(source), NULL);

  analyzed->root = pm_parse(&analyzed->parser);
  analyzed->valid = (analyzed->parser.error_list.size == 0);
  analyzed->parsed = true;
  analyzed->has_if_node = false;
  analyzed->has_elsif_node = false;
  analyzed->has_else_node = false;
  analyzed->has_end = false;
  analyzed->has_block_node = false;
  analyzed->has_case_node = false;
  analyzed->has_when_node = false;
  analyzed->has_for_node = false;
  analyzed->has_while_node = false;
  analyzed->has_until_node = false;
  analyzed->has_begin_node = false;
  analyzed->has_rescue_node = false;
  analyzed->has_ensure_node = false;

  return analyzed;
}

static bool has_if_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_if_node;
}

static bool has_elsif_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_elsif_node;
}

static bool has_else_node(analyzed_ruby_T* analyzed) {
  return analyzed->has_else_node;
}

static bool has_end(analyzed_ruby_T* analyzed) {
  return analyzed->has_end;
}

// static bool has_block_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_block_node;
// }

// static bool has_case_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_case_node;
// }

// static bool has_when_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_when_node;
// }

// static bool has_for_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_for_node;
// }

// static bool has_while_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_while_node;
// }

// static bool has_until_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_until_node;
// }

// static bool has_begin_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_begin_node;
// }

// static bool has_rescue_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_rescue_node;
// }

// static bool has_ensure_node(analyzed_ruby_T* analyzed) {
//   return analyzed->has_ensure_node;
// }

static bool has_error_message(analyzed_ruby_T* anlayzed, const char* message) {
  for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) anlayzed->parser.error_list.head; error != NULL;
       error = (const pm_diagnostic_t*) error->node.next) {
    if (strcmp(error->message, message) == 0) { return true; }
  }

  return false;
}

static bool search_if_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_IF_NODE) {
    analyzed->has_if_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_if_nodes, analyzed);
  }

  return false;
}

static bool search_block_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BLOCK_NODE) {
    analyzed->has_block_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_block_nodes, analyzed);
  }

  return false;
}

static bool search_case_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_CASE_MATCH_NODE) {
    analyzed->has_case_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_case_nodes, analyzed);
  }

  return false;
}

static bool search_while_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_WHILE_NODE) {
    analyzed->has_while_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_while_nodes, analyzed);
  }

  return false;
}

static bool search_for_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_FOR_NODE) {
    analyzed->has_for_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_for_nodes, analyzed);
  }

  return false;
}

static bool search_until_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_UNTIL_NODE) {
    analyzed->has_until_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_until_nodes, analyzed);
  }

  return false;
}

static bool search_begin_nodes(const pm_node_t* node, void* data) {
  analyzed_ruby_T* analyzed = (analyzed_ruby_T*) data;

  if (node->type == PM_BEGIN_NODE) {
    analyzed->has_begin_node = true;
    return true;
  } else {
    pm_visit_child_nodes(node, search_begin_nodes, analyzed);
  }

  return false;
}

static bool search_elsif_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'elsif', ignoring it")) {
    analyzed->has_elsif_node = true;
    return true;
  }

  return false;
}

static bool search_else_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'else', ignoring it")) {
    analyzed->has_else_node = true;
    return true;
  }

  return false;
}

static bool search_end_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'end', ignoring it")) {
    analyzed->has_end = true;
    return true;
  }

  return false;
}

static bool search_when_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'when', ignoring it")) {
    analyzed->has_when_node = true;
    return true;
  }

  return false;
}

static bool search_rescue_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'rescue', ignoring it")) {
    analyzed->has_rescue_node = true;
    return true;
  }

  return false;
}

static bool search_ensure_nodes(analyzed_ruby_T* analyzed) {
  if (has_error_message(analyzed, "unexpected 'ensure', ignoring it")) {
    analyzed->has_ensure_node = true;
    return true;
  }

  return false;
}

static analyzed_ruby_T* herb_analyze_ruby(char* source) {
  analyzed_ruby_T* analyzed = init_analyzed_ruby_T(source);

  pm_visit_node(analyzed->root, search_if_nodes, analyzed);
  pm_visit_node(analyzed->root, search_block_nodes, analyzed);
  pm_visit_node(analyzed->root, search_case_nodes, analyzed);
  pm_visit_node(analyzed->root, search_while_nodes, analyzed);
  pm_visit_node(analyzed->root, search_for_nodes, analyzed);
  pm_visit_node(analyzed->root, search_until_nodes, analyzed);
  pm_visit_node(analyzed->root, search_begin_nodes, analyzed);

  search_elsif_nodes(analyzed);
  search_else_nodes(analyzed);
  search_end_nodes(analyzed);
  search_when_nodes(analyzed);
  search_rescue_nodes(analyzed);
  search_ensure_nodes(analyzed);

  return analyzed;
}

static bool analyze_erb_content(const AST_NODE_T* node, void* data) {
  if (node->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) node;

    analyzed_ruby_T* analyzed = herb_analyze_ruby(erb_content_node->content->value);

    printf(
      "------------------------\nanalyzed (%p)\n------------------------\n%s\n------------------------\n  if:     %i\n "
      " elsif:  %i\n  else:   %i\n  end:    %i\n  block:  %i\n  case:   %i\n  when:   %i\n  for:    %i\n  while:  %i\n "
      " until:  %i\n  begin:  %i\n  "
      "rescue: %i\n  ensure: %i\n==================\n\n",
      (void*) analyzed,
      erb_content_node->content->value,
      analyzed->has_if_node,
      analyzed->has_elsif_node,
      analyzed->has_else_node,
      analyzed->has_end,
      analyzed->has_block_node,
      analyzed->has_case_node,
      analyzed->has_when_node,
      analyzed->has_for_node,
      analyzed->has_while_node,
      analyzed->has_until_node,
      analyzed->has_begin_node,
      analyzed->has_rescue_node,
      analyzed->has_ensure_node
    );

    if (false) {
      for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) analyzed->parser.error_list.head; error != NULL;
           error = (const pm_diagnostic_t*) error->node.next) {
        array_append(node->errors, ruby_parse_error_from_prism_error(error, node));
      }
    }

    erb_content_node->parsed_node = analyzed->root;
    erb_content_node->parsed = true;
    erb_content_node->valid = analyzed->valid;
    erb_content_node->analyzed_ruby = analyzed;
  }

  herb_visit_child_nodes(node, analyze_erb_content, data);

  return false;
}

static array_T* rewrite_node_array(AST_NODE_T* node, array_T* array, analyze_ruby_context_T* context) {
  printf(
    "Transforming node: %s, parent: %s\n",
    ast_node_type_to_string((AST_NODE_T*) node),
    ast_node_type_to_string(context->parent)
  );

  array_T* new_array = array_init(array_size(array));

  size_t index = 0;

  while (index < array_size(array)) {
    AST_NODE_T* item = array_get(array, index);
    printf("index: %zu, type: %s\n", index, ast_node_type_to_string(item));

    if (item->type != AST_ERB_CONTENT_NODE) {
      array_append(new_array, item);
      index++;
      continue;
    }

    AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) item;

    if (erb_node->analyzed_ruby->valid) {
      printf("Valid Ruby: '%s'\n", erb_node->content->value);
      array_append(new_array, item);
      index++;
      continue;
    }

    printf("Invalid Ruby: '%s'\n", erb_node->content->value);

    if (has_if_node(erb_node->analyzed_ruby)) {
      printf("Has if node\n");

      array_T* if_children = array_init(8);

      index++;

      AST_NODE_T* child = array_get(array, index);

      while (child != NULL) {
        if (child->type != AST_ERB_CONTENT_NODE) {
          array_append(if_children, child);
          index++;
          child = array_get(array, index);
          continue;
        }

        if (child->type == AST_ERB_CONTENT_NODE) {
          AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) child;

          if (erb_content_node->analyzed_ruby->valid && !has_elsif_node(erb_content_node->analyzed_ruby)
              && !has_else_node(erb_content_node->analyzed_ruby) && !has_end(erb_content_node->analyzed_ruby)) {
            array_append(if_children, child);
            index++;
            child = array_get(array, index);
            continue;
          }

          // array_append(new_array, child);
          child = NULL;
        }
      }

      // ELSIF
      child = array_get(array, index);

      AST_ERB_IF_NODE_T* subsequent = NULL;

      if (child->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;

        if (has_elsif_node(erb_node->analyzed_ruby)) {
          printf("Has elsif node\n");

          array_T* elsif_children = array_init(8);

          index++;

          AST_NODE_T* elsif_child = array_get(array, index);

          while (elsif_child != NULL) {
            if (elsif_child->type != AST_ERB_CONTENT_NODE) {
              array_append(elsif_children, elsif_child);
              index++;
              elsif_child = array_get(array, index);
              continue;
            }

            if (elsif_child->type == AST_ERB_CONTENT_NODE) {
              AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) elsif_child;

              if (erb_content_node->analyzed_ruby->valid && !has_elsif_node(erb_content_node->analyzed_ruby)
                  && !has_else_node(erb_content_node->analyzed_ruby) && !has_end(erb_content_node->analyzed_ruby)) {
                array_append(elsif_children, elsif_child);
                index++;
                elsif_child = array_get(array, index);
                continue;
              }

              elsif_child = NULL;
            }
          }

          subsequent = ast_erb_if_node_init(
            NULL,
            NULL,
            elsif_children,
            NULL,
            NULL,
            node->location->start,
            node->location->end,
            array_init(8)
          );
        }
      } else {
        array_append(new_array, child);
        index++;
      }

      // ELSE
      child = array_get(array, index);

      AST_ERB_ELSE_NODE_T* else_node = NULL;

      if (child->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;

        if (has_else_node(erb_node->analyzed_ruby)) {
          printf("Has else node\n");

          array_T* else_children = array_init(8);

          index++;

          AST_NODE_T* else_child = array_get(array, index);

          while (else_child != NULL) {
            if (else_child->type != AST_ERB_CONTENT_NODE) {
              array_append(else_children, else_child);
              index++;
              else_child = array_get(array, index);
              continue;
            }

            if (else_child->type == AST_ERB_CONTENT_NODE) {
              AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) else_child;

              if (erb_content_node->analyzed_ruby->valid && !has_elsif_node(erb_content_node->analyzed_ruby)
                  && !has_else_node(erb_content_node->analyzed_ruby) && !has_end(erb_content_node->analyzed_ruby)) {
                array_append(else_children, else_child);
                index++;
                else_child = array_get(array, index);
                continue;
              }

              else_child = NULL;
            }
          }

          else_node =
            ast_erb_else_node_init(NULL, else_children, node->location->start, node->location->end, array_init(8));

          subsequent->subsequent = (AST_NODE_T*) else_node;
        }
      } else {
        array_append(new_array, child);
        index++;
      }

      // END
      child = array_get(array, index);

      AST_ERB_END_NODE_T* end_node = NULL;

      if (child->type == AST_ERB_CONTENT_NODE) {
        AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;

        if (has_end(erb_node->analyzed_ruby)) {
          printf("Has end node\n");
          end_node = ast_erb_end_node_init(
            erb_node->tag_opening,
            erb_node->content,
            erb_node->tag_closing,
            node->location->start,
            node->location->end,
            erb_node->base.errors
          );

          index++;
        } else {
          array_append(new_array, child);
          index++;
        }
      } else {
        array_append(new_array, child);
        index++;
      }

      array_T* errors = array_init(8);

      AST_ERB_IF_NODE_T* if_node = ast_erb_if_node_init(
        NULL,
        NULL,
        if_children,
        (AST_NODE_T*) subsequent,
        end_node,
        node->location->start,
        node->location->end,
        errors
      );

      array_append(new_array, if_node);
    }

    index++;
  }

  return new_array;
}

static bool transform_erb_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;
  context->parent = (AST_NODE_T*) node;

  if (node->type == AST_HTML_ELEMENT_NODE) {
    AST_HTML_ELEMENT_NODE_T* element_node = (AST_HTML_ELEMENT_NODE_T*) node;
    element_node->body = rewrite_node_array((AST_NODE_T*) node, element_node->body, context);
  }

  herb_visit_child_nodes(node, transform_erb_nodes, data);

  return false;
}

void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document) {
  herb_visit_node((AST_NODE_T*) document, analyze_erb_content, NULL);

  analyze_ruby_context_T* context = malloc(sizeof(analyze_ruby_context_T));
  context->document = document;
  context->parent = NULL;
  context->ruby_context_stack = array_init(8);

  herb_visit_node((AST_NODE_T*) document, transform_erb_nodes, context);
}

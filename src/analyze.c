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
static bool visit(const AST_NODE_T* node, void* data) {
  if (node->type == AST_ERB_CONTENT_NODE) {
    AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) node;

    char* source = erb_content_node->content->value;

    pm_parser_t parser;
    pm_parser_init(&parser, (const uint8_t*) source, strlen(source), NULL);
    pm_node_t* root = pm_parse(&parser);

    for (const pm_diagnostic_t* error = (const pm_diagnostic_t*) parser.error_list.head; error != NULL;
         error = (const pm_diagnostic_t*) error->node.next) {
      array_append(node->errors, ruby_parse_error_from_prism_error(error, node));
    }

    erb_content_node->parsed_node = (void*) root;
    erb_content_node->parsed = true;
    erb_content_node->valid = (parser.error_list.size == 0);
    printf("hello\n");
  }

  herb_visit_child_nodes(node, visit, data);

  return false;
}

void herb_analyze_parse_tree(AST_DOCUMENT_NODE_T* document) {
  herb_visit_node((AST_NODE_T*) document, visit, NULL);
}

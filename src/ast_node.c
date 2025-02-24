#include "include/ast_node.h"
#include "include/buffer.h"
#include "include/token_struct.h"
#include "include/util.h"

#include <stdio.h>
#include <stdlib.h>

size_t ast_node_sizeof(void) {
  return sizeof(struct AST_NODE_STRUCT);
}

void ast_node_init(AST_NODE_T* node, ast_node_type_T type) {
  if (!node) { return; }

  node->type = type;
  node->start = location_init(0, 0);
  node->end = location_init(0, 0);
  node->children = array_init(ast_node_sizeof());
}

AST_LITERAL_T* ast_literal_node_init(const char* content) {
  AST_LITERAL_T* literal = malloc(sizeof(AST_LITERAL_T));

  ast_node_init(&literal->base, AST_LITERAL_NODE);

  literal->content = erbx_strdup(content);

  return literal;
}

AST_HTML_ELEMENT_NODE_T* ast_html_element_node_init(
  token_T* tag_name, bool is_void, AST_HTML_OPEN_TAG_NODE_T* open_tag, AST_HTML_ELEMENT_BODY_NODE_T* body,
  AST_HTML_CLOSE_TAG_NODE_T* close_tag
) {
  AST_HTML_ELEMENT_NODE_T* element = malloc(sizeof(AST_HTML_ELEMENT_NODE_T));

  ast_node_init(&element->base, AST_HTML_ELEMENT_NODE);

  element->tag_name = tag_name;
  element->is_void = is_void;
  element->open_tag = open_tag;
  element->body = body;
  element->close_tag = close_tag;

  if (body != NULL && body->base.children != NULL) { element->base.children = body->base.children; }

  ast_node_set_start(&element->base, open_tag->base.start);

  if (close_tag != NULL) {
    ast_node_set_end(&element->base, close_tag->base.end);
  } else {
    ast_node_set_end(&element->base, open_tag->base.end);
  }

  return element;
}

AST_HTML_ELEMENT_BODY_NODE_T* ast_html_element_body_node_init(void) {
  AST_HTML_ELEMENT_BODY_NODE_T* element = malloc(sizeof(AST_HTML_ELEMENT_BODY_NODE_T));

  ast_node_init(&element->base, AST_HTML_ELEMENT_BODY_NODE);

  element->base.type = AST_HTML_ELEMENT_BODY_NODE;

  return element;
}

AST_HTML_OPEN_TAG_NODE_T* ast_html_open_tag_node_init(
  token_T* tag_name, array_T* attributes, array_T* children, token_T* tag_opening, token_T* tag_closing
) {
  AST_HTML_OPEN_TAG_NODE_T* open_tag = malloc(sizeof(AST_HTML_OPEN_TAG_NODE_T));

  ast_node_init(&open_tag->base, AST_HTML_OPEN_TAG_NODE);

  open_tag->base.children = children;
  open_tag->attributes = attributes;
  open_tag->tag_opening = tag_opening;
  open_tag->tag_name = tag_name;
  open_tag->tag_closing = tag_closing;

  ast_node_set_start(&open_tag->base, open_tag->tag_opening->start);
  ast_node_set_end(&open_tag->base, open_tag->tag_closing->end);

  return open_tag;
}

// AST_HTML_SELF_CLOSE_TAG_NODE_T* ast_html_self_close_tag_node_init(AST_HTML_ATTRIBUTE_SET_NODE_T attributes, token_T*
// tag_opening, token_T* tag_closing) {
//   AST_HTML_SELF_CLOSE_TAG_NODE_T* open_tag =
//   (AST_HTML_SELF_CLOSE_TAG_NODE_T*)ast_node_init(AST_HTML_SELF_CLOSE_TAG_NODE); open_tag->attributes = &attributes;
//   open_tag->tag_opening = tag_opening;
//   open_tag->tag_closing = tag_closing;
//   return open_tag;
// }

AST_HTML_CLOSE_TAG_NODE_T* ast_html_close_tag_node_init(token_T* tag_opening, token_T* tag_name, token_T* tag_closing) {
  AST_HTML_CLOSE_TAG_NODE_T* close_tag = malloc(sizeof(AST_HTML_CLOSE_TAG_NODE_T));

  ast_node_init(&close_tag->base, AST_HTML_CLOSE_TAG_NODE);

  close_tag->tag_opening = tag_opening;
  close_tag->tag_name = tag_name;
  close_tag->tag_closing = tag_closing;

  ast_node_set_start(&close_tag->base, close_tag->tag_opening->start);
  ast_node_set_end(&close_tag->base, close_tag->tag_closing->end);

  return close_tag;
}

AST_HTML_COMMENT_T* ast_html_comment_node_init(token_T* comment_start, array_T* children, token_T* comment_end) {
  AST_HTML_COMMENT_T* comment = malloc(sizeof(AST_HTML_COMMENT_T));

  ast_node_init(&comment->base, AST_HTML_COMMENT_NODE);

  comment->comment_start = comment_start;
  comment->base.children = children;
  comment->comment_end = comment_end;

  return comment;
}

AST_ERB_CONTENT_NODE_T* ast_erb_content_node_init(token_T* tag_opening, token_T* content, token_T* tag_closing) {
  AST_ERB_CONTENT_NODE_T* erb = malloc(sizeof(AST_ERB_CONTENT_NODE_T));

  ast_node_init(&erb->base, AST_ERB_CONTENT_NODE);

  erb->tag_opening = tag_opening;
  erb->content = content;
  erb->tag_closing = tag_closing;

  ast_node_set_start(&erb->base, erb->tag_opening->start);
  ast_node_set_end(&erb->base, erb->tag_closing->end);

  return erb;
}

AST_HTML_TEXT_NODE_T* ast_html_text_node_init(const char* content) {
  AST_HTML_TEXT_NODE_T* text_node = malloc(sizeof(AST_HTML_TEXT_NODE_T));

  ast_node_init(&text_node->base, AST_HTML_TEXT_NODE);

  text_node->content = content;

  return text_node;
}

AST_HTML_DOCTYPE_NODE_T* ast_html_doctype_node_init(token_T* tag_opening, array_T* children, token_T* tag_closing) {
  AST_HTML_DOCTYPE_NODE_T* doctype = malloc(sizeof(AST_HTML_DOCTYPE_NODE_T));

  ast_node_init(&doctype->base, AST_HTML_DOCTYPE_NODE);

  doctype->tag_opening = tag_opening;
  doctype->base.children = children;
  doctype->tag_closing = tag_closing;

  ast_node_set_start(&doctype->base, doctype->tag_opening->start);
  ast_node_set_end(&doctype->base, doctype->tag_closing->end);

  return doctype;
}

AST_HTML_DOCUMENT_NODE_T* ast_html_document_node_init(void) {
  AST_HTML_DOCUMENT_NODE_T* document_node = malloc(sizeof(AST_HTML_DOCUMENT_NODE_T));

  ast_node_init(&document_node->base, AST_HTML_DOCUMENT_NODE);

  return document_node;
}

AST_HTML_ATTRIBUTE_SET_NODE_T* ast_html_attribute_set_node_init(void) {
  AST_HTML_ATTRIBUTE_SET_NODE_T* attributes_set = malloc(sizeof(AST_HTML_ATTRIBUTE_SET_NODE_T));

  ast_node_init(&attributes_set->base, AST_HTML_ATTRIBUTE_SET_NODE);
  attributes_set->attributes = array_init(ast_node_sizeof());

  return attributes_set;
}

AST_HTML_ATTRIBUTE_NODE_T* ast_html_attribute_node_init(
  AST_HTML_ATTRIBUTE_NAME_NODE_T* name, token_T* equals, AST_HTML_ATTRIBUTE_VALUE_NODE_T* value
) {
  AST_HTML_ATTRIBUTE_NODE_T* attribute = malloc(sizeof(AST_HTML_ATTRIBUTE_NODE_T));

  ast_node_init(&attribute->base, AST_HTML_ATTRIBUTE_NODE);

  attribute->name = name;
  attribute->equals = equals;
  attribute->value = value;

  ast_node_set_start(&attribute->base, attribute->name->base.start);

  if (value != NULL) {
    ast_node_set_end(&attribute->base, attribute->value->base.end);
  } else {
    ast_node_set_end(&attribute->base, attribute->name->base.end);
  }

  return attribute;
}

AST_HTML_ATTRIBUTE_NAME_NODE_T* ast_html_attribute_name_node_init(token_T* name) {
  AST_HTML_ATTRIBUTE_NAME_NODE_T* name_node = malloc(sizeof(AST_HTML_ATTRIBUTE_NAME_NODE_T));
  ast_node_init(&name_node->base, AST_HTML_ATTRIBUTE_NAME_NODE);

  name_node->name = name;

  ast_node_set_start(&name_node->base, name_node->name->start);
  ast_node_set_end(&name_node->base, name_node->name->end);

  return name_node;
}

AST_HTML_ATTRIBUTE_VALUE_NODE_T* ast_html_attribute_value_node_init(
  token_T* open_quote, array_T* children, token_T* close_quote
) {
  AST_HTML_ATTRIBUTE_VALUE_NODE_T* value = malloc(sizeof(AST_HTML_ATTRIBUTE_VALUE_NODE));
  ast_node_init(&value->base, AST_HTML_ATTRIBUTE_VALUE_NODE);

  value->quoted = open_quote != NULL && close_quote != NULL;
  value->open_quote = open_quote;
  value->close_quote = close_quote;

  if (value->quoted) {
    ast_node_set_start(&value->base, value->open_quote->start);
    ast_node_set_end(&value->base, value->close_quote->end);
  } else {
    // TODO: set location if attribute value is not quoted
  }

  if (children != NULL) { value->base.children = children; }

  return value;
}

AST_UNEXPECTED_TOKEN_NODE_T* ast_unexpected_node_init(const char* message, const char* expected, const char* got) {
  AST_UNEXPECTED_TOKEN_NODE_T* unexpected_token = malloc(sizeof(AST_UNEXPECTED_TOKEN_NODE_T));

  ast_node_init(&unexpected_token->base, AST_HTML_ATTRIBUTE_VALUE_NODE);

  unexpected_token->message = message;
  unexpected_token->expected = expected;
  unexpected_token->got = got;

  return unexpected_token;
}

// char* ast_node_name(AST_NODE_T* node) {
//   return node->name;
// }

ast_node_type_T ast_node_type(AST_NODE_T* node) {
  return node->type;
}

size_t ast_node_child_count(AST_NODE_T* node) {
  return array_size(node->children);
}

array_T* ast_node_children(AST_NODE_T* node) {
  return node->children;
}

void ast_node_set_start(AST_NODE_T* node, location_T* location) {
  node->start = location;
}

void ast_node_set_end(AST_NODE_T* node, location_T* location) {
  node->end = location;
}

void ast_node_set_start_from_token(AST_NODE_T* node, token_T* token) {
  ast_node_set_start(node, token->start);
}

void ast_node_set_end_from_token(AST_NODE_T* node, token_T* token) {
  ast_node_set_end(node, token->end);
}

void ast_node_set_locations_from_token(AST_NODE_T* node, token_T* token) {
  ast_node_set_start_from_token(node, token);
  ast_node_set_end_from_token(node, token);
}

char* ast_node_type_to_string(AST_NODE_T* node) {
  switch (node->type) {
    case AST_LITERAL_NODE: return "AST_LITERAL_NODE";
    case AST_STRING_COMPOUND_NODE: return "AST_STRING_COMPOUND_NODE";
    case AST_UNEXCPECTED_TOKEN_NODE: return "AST_UNEXPECTED_TOKEN_NODE";

    case AST_HTML_DOCUMENT_NODE: return "AST_HTML_DOCUMENT_NODE";
    case AST_HTML_DOCTYPE_NODE: return "AST_HTML_DOCTYPE_NODE";
    case AST_HTML_COMMENT_NODE: return "AST_HTML_COMMENT_NODE";
    case AST_HTML_ELEMENT_NODE: return "AST_HTML_ELEMENT_NODE";
    case AST_HTML_TEXT_NODE: return "AST_HTML_TEXT_NODE";

    case AST_HTML_ELEMENT_BODY_NODE: return "AST_HTML_ELEMENT_BODY_NODE";

    case AST_HTML_OPEN_TAG_NODE: return "AST_HTML_OPEN_TAG_NODE";
    case AST_HTML_CLOSE_TAG_NODE: return "AST_HTML_CLOSE_TAG_NODE";
    case AST_HTML_SELF_CLOSE_TAG_NODE: return "AST_HTML_SELF_CLOSE_TAG_NODE";

    case AST_HTML_ATTRIBUTE_SET_NODE: return "AST_HTML_ATTRIBUTE_SET_NODE";
    case AST_HTML_ATTRIBUTE_NODE: return "AST_HTML_ATTRIBUTE_NODE";
    case AST_HTML_ATTRIBUTE_CONDITIONAL_NODE: return "AST_HTML_ATTRIBUTE_CONDITIONAL_NODE";
    case AST_HTML_ATTRIBUTE_NAME_NODE: return "AST_HTML_ATTRIBUTE_NAME_NODE";
    case AST_HTML_ATTRIBUTE_VALUE_NODE: return "AST_HTML_ATTRIBUTE_VALUE_NODE";
    case AST_HTML_ATTRIBUTE_SPREAD_NODE: return "AST_HTML_ATTRIBUTE_SPREAD_NODE";

    case AST_HTML_WHITESPACE_NODE: return "AST_HTML_WHITESPACE_NODE";

    case AST_ERB_LOUD_NODE: return "AST_ERB_LOUD_NODE";
    case AST_ERB_SILENT_NODE: return "AST_ERB_SILENT_NODE";
    case AST_ERB_RAW_NODE: return "AST_ERB_RAW_NODE";
    case AST_ERB_BLOCK_NODE: return "AST_ERB_BLOCK_NODE";
    case AST_ERB_COMMENT_NODE: return "AST_ERB_COMMENT_NODE";

    case AST_ERB_CONDITIONAL_NODE: return "AST_ERB_CONDITIONAL_NODE";
    case AST_ERB_ITERATION_NODE: return "AST_ERB_ITERATION_NODE";
    case AST_ERB_FLOW_CONTROL_NODE: return "AST_ERB_FLOW_CONTROL_NODE";
    case AST_ERB_BEGIN_RESCUE_NODE: return "AST_ERB_BEGIN_RESCUE_NODE";

    case AST_ERB_RENDER_CALL_NODE: return "AST_ERB_RENDER_CALL_NODE";
    case AST_ERB_YIELD_NODE: return "AST_ERB_YIELD_NODE";
    case AST_ERB_CONTENT_NODE: return "AST_ERB_CONTENT_NODE";

    case AST_RUBY_STATEMENTS_NODE: return "AST_RUBY_STATEMENTS_NODE";

    case AST_NOOP_NODE: return "AST_NOOP_NODE";
  }
}

char* ast_node_human_type(AST_NODE_T* node) {
  switch (node->type) {
    case AST_LITERAL_NODE: return "Literal";
    case AST_STRING_COMPOUND_NODE: return "StringCompound";
    case AST_UNEXCPECTED_TOKEN_NODE: return "UnexpectedToken";

    case AST_HTML_DOCUMENT_NODE: return "DocumentNode";
    case AST_HTML_DOCTYPE_NODE: return "Doctype";
    case AST_HTML_COMMENT_NODE: return "Comment";
    case AST_HTML_ELEMENT_NODE: return "Element";
    case AST_HTML_TEXT_NODE: return "TextContent";

    case AST_HTML_ELEMENT_BODY_NODE: return "ElementBody";

    case AST_HTML_OPEN_TAG_NODE: return "OpenTag";
    case AST_HTML_CLOSE_TAG_NODE: return "CloseTag";
    case AST_HTML_SELF_CLOSE_TAG_NODE: return "SelfCloseTag";

    case AST_HTML_ATTRIBUTE_SET_NODE: return "AttributeSet";
    case AST_HTML_ATTRIBUTE_NODE: return "Attribute";
    case AST_HTML_ATTRIBUTE_CONDITIONAL_NODE: return "ConditionalAttribute";
    case AST_HTML_ATTRIBUTE_NAME_NODE: return "AttributeName";
    case AST_HTML_ATTRIBUTE_VALUE_NODE: return "AttributeValue";
    case AST_HTML_ATTRIBUTE_SPREAD_NODE: return "AttributeSpread";

    case AST_HTML_WHITESPACE_NODE: return "Whitespace";

    case AST_ERB_LOUD_NODE: return "ERBOutput";
    case AST_ERB_SILENT_NODE: return "ERBExpression";
    case AST_ERB_RAW_NODE: return "ERBRaw";
    case AST_ERB_BLOCK_NODE: return "ERBBlock";
    case AST_ERB_COMMENT_NODE: return "ERBComment";

    case AST_ERB_CONDITIONAL_NODE: return "ERBConditional";
    case AST_ERB_ITERATION_NODE: return "ERBIteration";
    case AST_ERB_FLOW_CONTROL_NODE: return "ERBFlowControl";
    case AST_ERB_BEGIN_RESCUE_NODE: return "ERBBeginRescue";

    case AST_ERB_RENDER_CALL_NODE: return "ERBRenderCall";
    case AST_ERB_YIELD_NODE: return "ERBYield";
    case AST_ERB_CONTENT_NODE: return "ERBContent";

    case AST_RUBY_STATEMENTS_NODE: return "RubyStatements";

    case AST_NOOP_NODE: return "Noop";
  }
}

void ast_indent(buffer_T* buffer, size_t indent, bool child) {
  for (size_t i = 0; i < indent; i++) {
    buffer_append(buffer, "    ");
  }
}

// void ast_indent(buffer_T* buffer, size_t indent) {
//   if (indent >= 3) {
//     buffer_append_whitespace(buffer, 4);
//     buffer_append(buffer, "│   ");
//     buffer_append(buffer, "│   ");
//     buffer_append_whitespace(buffer, (indent - 3) * 4);
//   } else if (indent >= 2) {
//     buffer_append_whitespace(buffer, 4);
//     buffer_append(buffer, "│   ");
//     buffer_append_whitespace(buffer, (indent - 2) * 4);
//   } else {
//     buffer_append_whitespace(buffer, indent * 4);
//   }
// }

bool should_print_children(AST_NODE_T* node, int indent) {
  if (node == NULL) { return false; }
  if (node->children == NULL) { return false; }

  const ast_node_type_T node_types_with_children[] = {
    AST_HTML_DOCUMENT_NODE,
    AST_HTML_COMMENT_NODE,
    AST_HTML_ELEMENT_NODE,
  };

  size_t num_types = sizeof(node_types_with_children) / sizeof(node_types_with_children[0]);

  for (size_t i = 0; i < num_types; i++) {
    if (node->type == node_types_with_children[i]) { return true; }
  }

  return false;
}

void ast_node_pretty_print_newline(size_t indent, size_t relative_indent, buffer_T* buffer) {
  ast_indent(buffer, indent, true);
  ast_indent(buffer, relative_indent, false);
  buffer_append(buffer, "\n");
}

void ast_node_pretty_print_label(
  char* name, size_t indent, size_t relative_indent, bool last_property, buffer_T* buffer
) {
  ast_indent(buffer, indent, true);
  ast_indent(buffer, relative_indent, false);

  if (last_property) {
    buffer_append(buffer, "└── ");
  } else {
    buffer_append(buffer, "├── ");
  }

  buffer_append(buffer, name);
  buffer_append(buffer, ": ");
}

void ast_node_pretty_print_property(
  AST_NODE_T* node, char* name, const char* value, size_t indent, size_t relative_indent, bool last_property,
  buffer_T* buffer
) {
  ast_node_pretty_print_label(name, indent, relative_indent, last_property, buffer);
  buffer_append(buffer, value);
  buffer_append(buffer, "\n");
}

void ast_node_pretty_print_array(
  AST_NODE_T* node, char* name, array_T* children, size_t indent, size_t relative_indent, bool last_property,
  buffer_T* buffer
) {
  if (array_size(children) == 0) {
    ast_node_pretty_print_property(node, name, "[]", indent, relative_indent, last_property, buffer);

    return;
  }

  ast_node_pretty_print_label(name, indent, relative_indent, last_property, buffer);

  buffer_append(buffer, "(");

  char count[16];
  sprintf(count, "%zu", array_size(children));
  buffer_append(buffer, count);
  buffer_append(buffer, ")\n");

  if (indent < 20) {
    for (size_t i = 0; i < array_size(children); i++) {
      AST_NODE_T* child = array_get(children, i);
      ast_indent(buffer, indent, true);
      ast_indent(buffer, relative_indent + 1, false);

      if (i == array_size(children) - 1) {
        buffer_append(buffer, "└── ");
      } else {
        buffer_append(buffer, "├── ");
      }

      ast_node_pretty_print(child, indent + 1, relative_indent + 1, buffer);

      if (i != array_size(children) - 1) { ast_node_pretty_print_newline(indent + 1, relative_indent, buffer); }
    }
  }
}

void ast_node_pretty_print_children(
  AST_NODE_T* node, size_t indent, size_t relative_indent, bool last_property, buffer_T* buffer
) {
  ast_node_pretty_print_array(node, "children", node->children, indent, relative_indent, last_property, buffer);
}

void ast_node_pretty_print_location(location_T* start, location_T* end, buffer_T* buffer) {
  buffer_append(buffer, "(location: (");
  char location[128];
  sprintf(
    location,
    "%zu,%zu)-(%zu,%zu",
    (start && start->line) ? start->line : 0,
    (start && start->column) ? start->column : 0,
    (end && end->line) ? end->line : 0,
    (end && end->column) ? end->column : 0
  );
  buffer_append(buffer, location);
  buffer_append(buffer, "))");
}

void ast_node_pretty_print_token_property(
  token_T* token, char* name, size_t indent, size_t relative_ident, bool last_property, buffer_T* buffer
) {
  ast_node_pretty_print_label(name, indent, relative_ident, last_property, buffer);

  if (token != NULL && token->value != NULL) {
    buffer_append(buffer, quoted_string(token->value));
    buffer_append(buffer, " ");
    ast_node_pretty_print_location(token->start, token->end, buffer);
  } else {
    buffer_append(buffer, "∅");
  }

  buffer_append(buffer, "\n");
}

bool print_locations = true;

void ast_node_pretty_print(AST_NODE_T* node, size_t indent, size_t relative_indent, buffer_T* buffer) {
  if (!node) { return; }

  buffer_append(buffer, "@ ");
  buffer_append(buffer, ast_node_human_type(node));
  buffer_append(buffer, " ");

  if (print_locations) { ast_node_pretty_print_location(node->start, node->end, buffer); }

  buffer_append(buffer, "\n");

  switch (node->type) {
    case AST_HTML_ELEMENT_NODE: {
      AST_HTML_ELEMENT_NODE_T* element = (AST_HTML_ELEMENT_NODE_T*) node;

      char* is_void = element->is_void ? "true" : "false";

      ast_node_pretty_print_token_property(element->tag_name, "tag_name", indent, relative_indent, false, buffer);
      ast_node_pretty_print_property(node, "is_void", is_void, indent, relative_indent, false, buffer);
      ast_node_pretty_print_label("open_tag", indent, relative_indent, false, buffer);

      if (element->open_tag) {
        buffer_append(buffer, "\n");
        ast_indent(buffer, indent, true);
        ast_indent(buffer, relative_indent + 1, false);

        buffer_append(buffer, "└── ");
        ast_node_pretty_print((AST_NODE_T*) element->open_tag, indent, relative_indent + 2, buffer);
      } else {
        buffer_append(buffer, " ∅\n");
      }

      if (!element->is_void) {
        ast_node_pretty_print_children(node, indent, relative_indent, false, buffer);
        ast_node_pretty_print_label("close_tag", indent, relative_indent, true, buffer);

        if (element->close_tag) {
          buffer_append(buffer, "\n");
          ast_indent(buffer, indent, true);
          ast_indent(buffer, relative_indent + 1, false);

          buffer_append(buffer, "└── ");
          ast_node_pretty_print((AST_NODE_T*) element->close_tag, indent, relative_indent + 2, buffer);
        } else {
          buffer_append(buffer, " ∅\n");
        }
      }
    } break;

    case AST_HTML_OPEN_TAG_NODE: {
      AST_HTML_OPEN_TAG_NODE_T* open_tag = (AST_HTML_OPEN_TAG_NODE_T*) node;

      ast_node_pretty_print_token_property(
        open_tag->tag_opening,
        "tag_opening",
        indent,
        relative_indent,
        false,
        buffer
      );

      ast_node_pretty_print_token_property(open_tag->tag_name, "tag_name", indent, relative_indent, false, buffer);

      ast_node_pretty_print_token_property(
        open_tag->tag_closing,
        "tag_closing",
        indent,
        relative_indent,
        false,
        buffer
      );

      ast_node_pretty_print_property(
        node,
        "is_void",
        open_tag->is_void ? "true" : "false",
        indent,
        relative_indent,
        false,
        buffer
      );

      if (open_tag->attributes) {
        ast_node_pretty_print_array(
          (AST_NODE_T*) open_tag,
          "attributes",
          open_tag->attributes,
          indent,
          relative_indent,
          false,
          buffer
        );
      } else {
        ast_node_pretty_print_property(node, "attributes", "∅", indent, relative_indent, true, buffer);
      }

      ast_node_pretty_print_children(node, indent, relative_indent, true, buffer);
    } break;

    case AST_HTML_CLOSE_TAG_NODE: {
      const AST_HTML_CLOSE_TAG_NODE_T* close_tag = (AST_HTML_CLOSE_TAG_NODE_T*) node;

      ast_node_pretty_print_token_property(
        close_tag->tag_opening,
        "tag_opening",
        indent,
        relative_indent,
        false,
        buffer
      );
      ast_node_pretty_print_token_property(close_tag->tag_name, "tag_name", indent, relative_indent, false, buffer);
      ast_node_pretty_print_token_property(
        close_tag->tag_closing,
        "tag_closing",
        indent,
        relative_indent,
        true,
        buffer
      );

    } break;

    case AST_HTML_TEXT_NODE: {
      const AST_HTML_TEXT_NODE_T* text_node = (AST_HTML_TEXT_NODE_T*) node;

      char* value = text_node->content ? quoted_string(escape_newlines(text_node->content)) : "∅";
      ast_node_pretty_print_property(node, "content", value, indent, relative_indent, true, buffer);
    } break;

    case AST_HTML_COMMENT_NODE: {
      const AST_HTML_COMMENT_T* comment = (AST_HTML_COMMENT_T*) node;
      ast_node_pretty_print_children(node, indent, relative_indent, true, buffer);
    } break;

    case AST_ERB_CONTENT_NODE: {
      AST_ERB_CONTENT_NODE_T* erb_content_node = (AST_ERB_CONTENT_NODE_T*) node;

      ast_node_pretty_print_token_property(
        erb_content_node->tag_opening,
        "tag_opening",
        indent,
        relative_indent + 0,
        false,
        buffer
      );
      ast_node_pretty_print_token_property(
        erb_content_node->content,
        "content",
        indent,
        relative_indent + 0,
        false,
        buffer
      );
      ast_node_pretty_print_token_property(
        erb_content_node->tag_closing,
        "tag_closing",
        indent,
        relative_indent + 0,
        true,
        buffer
      );
    } break;

    case AST_HTML_ATTRIBUTE_NODE: {
      AST_HTML_ATTRIBUTE_NODE_T* attribute = (AST_HTML_ATTRIBUTE_NODE_T*) node;

      ast_node_pretty_print_label("name", indent, relative_indent, false, buffer);

      if (attribute->name) {
        buffer_append(buffer, "\n");
        ast_indent(buffer, indent, true);
        ast_indent(buffer, relative_indent + 1, false);

        buffer_append(buffer, "└── ");
        ast_node_pretty_print((AST_NODE_T*) attribute->name, indent, relative_indent + 1, buffer);
      } else {
        buffer_append(buffer, "∅\n");
      }

      ast_node_pretty_print_token_property(attribute->equals, "equals", indent, relative_indent, false, buffer);

      ast_node_pretty_print_label("value", indent, relative_indent, true, buffer);

      if (attribute->value) {
        buffer_append(buffer, "\n");
        ast_indent(buffer, indent, true);
        ast_indent(buffer, relative_indent + 1, false);

        buffer_append(buffer, "└── ");
        ast_node_pretty_print((AST_NODE_T*) attribute->value, indent, relative_indent + 1, buffer);
      } else {
        buffer_append(buffer, "∅\n");
      }

    } break;

    case AST_HTML_ATTRIBUTE_NAME_NODE: {
      AST_HTML_ATTRIBUTE_NAME_NODE_T* attribute_name = (AST_HTML_ATTRIBUTE_NAME_NODE_T*) node;

      ast_node_pretty_print_token_property(attribute_name->name, "name", indent, relative_indent + 1, true, buffer);
    } break;

    case AST_HTML_ATTRIBUTE_VALUE_NODE: {
      AST_HTML_ATTRIBUTE_VALUE_NODE_T* attribute_value = (AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node;

      ast_node_pretty_print_token_property(
        attribute_value->open_quote,
        "open_quote",
        indent,
        relative_indent + 1,
        false,
        buffer
      );
      ast_node_pretty_print_token_property(
        attribute_value->close_quote,
        "close_quote",
        indent,
        relative_indent + 1,
        false,
        buffer
      );

      ast_node_pretty_print_children(node, indent, relative_indent + 1, true, buffer);

    } break;

    case AST_HTML_DOCUMENT_NODE: {
      ast_node_pretty_print_children(node, indent, 0, true, buffer);
    } break;

    case AST_HTML_DOCTYPE_NODE: {
      AST_HTML_DOCTYPE_NODE_T* doctype = (AST_HTML_DOCTYPE_NODE_T*) node;

      ast_node_pretty_print_token_property(doctype->tag_opening, "tag_opening", indent, relative_indent, false, buffer);
      ast_node_pretty_print_token_property(doctype->tag_closing, "tag_closing", indent, relative_indent, false, buffer);

      ast_node_pretty_print_children(node, indent, relative_indent, true, buffer);
    } break;

    case AST_LITERAL_NODE: {
      AST_LITERAL_T* literal = (AST_LITERAL_T*) node;
      ast_node_pretty_print_property(
        node,
        "content",
        quoted_string(literal->content),
        indent,
        relative_indent,
        true,
        buffer
      );
    } break;

    default: {
      ast_node_pretty_print_children(node, indent, 0, true, buffer);
    };
  }
}

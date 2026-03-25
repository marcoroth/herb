#include "../../include/analyze/action_view/tag_helpers.h"
#include "../../include/analyze/action_view/attribute_extraction_helpers.h"
#include "../../include/analyze/action_view/tag_helper_handler.h"
#include "../../include/analyze/action_view/tag_helper_node_builders.h"
#include "../../include/analyze/analyze.h"
#include "../../include/ast/ast_nodes.h"
#include "../../include/herb.h"
#include "../../include/lib/hb_allocator.h"
#include "../../include/lib/hb_array.h"
#include "../../include/lib/hb_buffer.h"
#include "../../include/lib/hb_string.h"
#include "../../include/lib/string.h"
#include "../../include/location/position.h"
#include "../../include/parser/parser_helpers.h"
#include "../../include/util/html_util.h"
#include "../../include/util/util.h"
#include "../../include/visitor.h"

#include <prism.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

extern bool detect_link_to(pm_call_node_t*, pm_parser_t*);
extern bool is_route_helper_node(pm_node_t*, pm_parser_t*);
extern char* wrap_in_url_for(const char*, size_t, hb_allocator_T*);
extern char* extract_link_to_href(pm_call_node_t*, pm_parser_t*, hb_allocator_T*);
extern bool detect_turbo_frame_tag(pm_call_node_t*, pm_parser_t*);
extern char* extract_turbo_frame_tag_id(pm_call_node_t*, pm_parser_t*, hb_allocator_T*);
extern bool detect_javascript_include_tag(pm_call_node_t*, pm_parser_t*);
extern char* extract_javascript_include_tag_src(pm_call_node_t*, pm_parser_t*, hb_allocator_T*);
extern char* wrap_in_javascript_path(const char*, size_t, const char*, hb_allocator_T*);
extern bool javascript_include_tag_source_is_url(const char*, size_t);
extern bool detect_image_tag(pm_call_node_t*, pm_parser_t*);
extern char* extract_image_tag_src(pm_call_node_t*, pm_parser_t*, hb_allocator_T*);
extern char* wrap_in_image_path(const char*, size_t, hb_allocator_T*);
extern bool image_tag_source_is_url(const char*, size_t);

typedef struct {
  pm_parser_t parser;
  pm_node_t* root;
  const uint8_t* prism_source;
  char* content_string;
  tag_helper_info_T* info;
  const tag_helper_handler_T* matched_handler;
  const char* original_source;
  size_t erb_content_offset;
  char* condition_source;
  char* condition_type;
} tag_helper_parse_context_T;

static tag_helper_parse_context_T* parse_tag_helper_content(
  const char* content_string,
  const char* original_source,
  size_t erb_content_offset,
  hb_allocator_T* allocator
) {
  if (!content_string) { return NULL; }

  tag_helper_parse_context_T* parse_context = hb_allocator_alloc(allocator, sizeof(tag_helper_parse_context_T));
  if (!parse_context) { return NULL; }

  parse_context->content_string = hb_allocator_strdup(allocator, content_string);
  parse_context->prism_source = (const uint8_t*) parse_context->content_string;
  parse_context->original_source = original_source;
  parse_context->erb_content_offset = erb_content_offset;

  pm_parser_init(&parse_context->parser, parse_context->prism_source, strlen(parse_context->content_string), NULL);
  parse_context->root = pm_parse(&parse_context->parser);

  if (!parse_context->root) {
    pm_parser_free(&parse_context->parser);
    hb_allocator_dealloc(allocator, parse_context->content_string);
    hb_allocator_dealloc(allocator, parse_context);
    return NULL;
  }

  parse_context->info = tag_helper_info_init(allocator);
  parse_context->condition_source = NULL;
  parse_context->condition_type = NULL;

  tag_helper_search_data_T search = { .tag_helper_node = NULL,
                                      .source = parse_context->prism_source,
                                      .parser = &parse_context->parser,
                                      .info = parse_context->info,
                                      .found = false,
                                      .postfix_conditional_node = NULL };
  pm_visit_node(parse_context->root, search_tag_helper_node, &search);

  if (!search.found) {
    tag_helper_info_free(&parse_context->info);
    pm_node_destroy(&parse_context->parser, parse_context->root);
    pm_parser_free(&parse_context->parser);
    hb_allocator_dealloc(allocator, parse_context->content_string);
    hb_allocator_dealloc(allocator, parse_context);
    return NULL;
  }

  if (search.postfix_conditional_node) {
    if (search.postfix_conditional_node->type == PM_IF_NODE) {
      pm_if_node_t* if_node = (pm_if_node_t*) search.postfix_conditional_node;
      size_t predicate_length = if_node->predicate->location.end - if_node->predicate->location.start;
      parse_context->condition_source =
        hb_allocator_strndup(allocator, (const char*) if_node->predicate->location.start, predicate_length);
      parse_context->condition_type = hb_allocator_strdup(allocator, "if");
    } else if (search.postfix_conditional_node->type == PM_UNLESS_NODE) {
      pm_unless_node_t* unless_node = (pm_unless_node_t*) search.postfix_conditional_node;
      size_t predicate_length = unless_node->predicate->location.end - unless_node->predicate->location.start;
      parse_context->condition_source =
        hb_allocator_strndup(allocator, (const char*) unless_node->predicate->location.start, predicate_length);
      parse_context->condition_type = hb_allocator_strdup(allocator, "unless");
    }
  }

  parse_context->matched_handler = search.matched_handler;
  return parse_context;
}

static void free_tag_helper_parse_context(tag_helper_parse_context_T* parse_context) {
  if (!parse_context) { return; }

  hb_allocator_T* allocator = parse_context->info ? parse_context->info->allocator : NULL;

  tag_helper_info_free(&parse_context->info);
  pm_node_destroy(&parse_context->parser, parse_context->root);
  pm_parser_free(&parse_context->parser);

  if (allocator) {
    hb_allocator_dealloc(allocator, parse_context->content_string);
    hb_allocator_dealloc(allocator, parse_context);
  }
}

static AST_NODE_T* wrap_in_conditional_if_needed(
  AST_NODE_T* element,
  tag_helper_parse_context_T* parse_context,
  hb_allocator_T* allocator
) {
  if (!element || !parse_context || !parse_context->condition_source || !parse_context->condition_type) {
    return element;
  }

  position_T start = element->location.start;
  position_T end = element->location.end;

  hb_buffer_T content_buffer;
  hb_buffer_init(&content_buffer, 64, allocator);
  hb_buffer_append(&content_buffer, " ");
  hb_buffer_append(&content_buffer, parse_context->condition_type);
  hb_buffer_append(&content_buffer, " ");
  hb_buffer_append(&content_buffer, parse_context->condition_source);
  hb_buffer_append(&content_buffer, " ");
  const char* content_string = hb_buffer_value(&content_buffer);

  token_T* tag_opening = create_synthetic_token(allocator, "<%", TOKEN_ERB_START, start, start);
  token_T* content_token = create_synthetic_token(allocator, content_string, TOKEN_ERB_CONTENT, start, end);
  token_T* tag_closing = create_synthetic_token(allocator, "%>", TOKEN_ERB_END, end, end);

  hb_array_T* statements = hb_array_init(1, allocator);
  hb_array_append(statements, element);

  token_T* end_opening = create_synthetic_token(allocator, "<%", TOKEN_ERB_START, end, end);
  token_T* end_content = create_synthetic_token(allocator, " end ", TOKEN_ERB_CONTENT, end, end);
  token_T* end_closing = create_synthetic_token(allocator, "%>", TOKEN_ERB_END, end, end);

  AST_ERB_END_NODE_T* end_node =
    ast_erb_end_node_init(end_opening, end_content, end_closing, end, end, hb_array_init(0, allocator), allocator);

  herb_prism_node_T empty_prism_node = HERB_PRISM_NODE_EMPTY;

  if (strcmp(parse_context->condition_type, "if") == 0) {
    AST_ERB_IF_NODE_T* if_node = ast_erb_if_node_init(
      tag_opening,
      content_token,
      tag_closing,
      NULL,
      empty_prism_node,
      statements,
      NULL,
      end_node,
      start,
      end,
      hb_array_init(0, allocator),
      allocator
    );

    return (AST_NODE_T*) if_node;
  } else {
    AST_ERB_UNLESS_NODE_T* unless_node = ast_erb_unless_node_init(
      tag_opening,
      content_token,
      tag_closing,
      NULL,
      empty_prism_node,
      statements,
      NULL,
      end_node,
      start,
      end,
      hb_array_init(0, allocator),
      allocator
    );

    return (AST_NODE_T*) unless_node;
  }
}

static bool is_postfix_if_node(const pm_node_t* node) {
  if (node->type != PM_IF_NODE) { return false; }
  pm_if_node_t* if_node = (pm_if_node_t*) node;
  return if_node->if_keyword_loc.start != NULL && if_node->end_keyword_loc.start == NULL;
}

static bool is_postfix_unless_node(const pm_node_t* node) {
  if (node->type != PM_UNLESS_NODE) { return false; }
  pm_unless_node_t* unless_node = (pm_unless_node_t*) node;
  return unless_node->keyword_loc.start != NULL && unless_node->end_keyword_loc.start == NULL;
}

bool search_tag_helper_node(const pm_node_t* node, void* data) {
  tag_helper_search_data_T* search_data = (tag_helper_search_data_T*) data;

  if (node->type == PM_CALL_NODE) {
    pm_call_node_t* call_node = (pm_call_node_t*) node;
    tag_helper_handler_T* handlers = get_tag_helper_handlers();
    size_t handlers_count = get_tag_helper_handlers_count();

    for (size_t i = 0; i < handlers_count; i++) {
      if (handlers[i].detect(call_node, search_data->parser)) {
        search_data->tag_helper_node = node;
        search_data->matched_handler = &handlers[i];
        search_data->found = true;

        if (search_data->info) {
          search_data->info->call_node = call_node;
          search_data->info->tag_name =
            handlers[i].extract_tag_name(call_node, search_data->parser, search_data->info->allocator);
          search_data->info->content =
            handlers[i].extract_content(call_node, search_data->parser, search_data->info->allocator);
          search_data->info->has_block = handlers[i].supports_block();
        }

        return false;
      }
    }

    return false;
  }

  if (is_postfix_if_node(node) || is_postfix_unless_node(node)) {
    const pm_node_t* saved = search_data->postfix_conditional_node;
    search_data->postfix_conditional_node = node;
    pm_visit_child_nodes(node, search_tag_helper_node, search_data);

    if (!search_data->found) { search_data->postfix_conditional_node = saved; }

    return search_data->found;
  }

  pm_visit_child_nodes(node, search_tag_helper_node, search_data);

  return search_data->found;
}

position_T byte_offset_to_position(const char* source, size_t offset) {
  position_T position = { .line = 1, .column = 1 };

  if (!source) { return position; }

  for (size_t i = 0; i < offset && source[i] != '\0'; i++) {
    if (source[i] == '\n') {
      position.line++;
      position.column = 1;
    } else {
      position.column++;
    }
  }

  return position;
}

position_T prism_location_to_position_with_offset(
  const pm_location_t* pm_location,
  const char* original_source,
  size_t erb_content_offset,
  const uint8_t* erb_content_source
) {
  position_T default_position = { .line = 1, .column = 1 };

  if (!pm_location || !pm_location->start || !original_source || !erb_content_source) { return default_position; }

  size_t offset_in_erb = (size_t) (pm_location->start - erb_content_source);
  size_t total_offset = erb_content_offset + offset_in_erb;

  size_t source_length = strlen(original_source);
  if (total_offset > source_length) { return byte_offset_to_position(original_source, erb_content_offset); }

  return byte_offset_to_position(original_source, total_offset);
}

size_t calculate_byte_offset_from_position(const char* source, position_T position) {
  if (!source) { return 0; }

  size_t offset = 0;
  uint32_t line = 1;
  uint32_t column = 1;

  while (source[offset] != '\0') {
    if (line == position.line && column == position.column) { return offset; }

    if (source[offset] == '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }

    offset++;
  }

  return offset;
}

static void prism_node_location_to_positions(
  const pm_location_t* location,
  tag_helper_parse_context_T* parse_context,
  position_T* out_start,
  position_T* out_end
) {
  *out_start = prism_location_to_position_with_offset(
    location,
    parse_context->original_source,
    parse_context->erb_content_offset,
    parse_context->prism_source
  );

  pm_location_t end_location = { .start = location->end, .end = location->end };
  *out_end = prism_location_to_position_with_offset(
    &end_location,
    parse_context->original_source,
    parse_context->erb_content_offset,
    parse_context->prism_source
  );
}

static void calculate_tag_name_positions(
  tag_helper_parse_context_T* parse_context,
  position_T default_start,
  position_T default_end,
  position_T* out_start,
  position_T* out_end
) {
  *out_start = default_start;
  *out_end = default_end;

  if (parse_context->info->call_node && parse_context->info->call_node->message_loc.start) {
    prism_node_location_to_positions(&parse_context->info->call_node->message_loc, parse_context, out_start, out_end);
  }
}

static const char* JAVASCRIPT_INCLUDE_TAG_PATH_OPTIONS[] = { "protocol", "extname", "host", "skip_pipeline", NULL };

static char* extract_path_options_from_keyword_hash(
  pm_call_node_t* call_node,
  hb_allocator_T* allocator
) {
  if (!call_node || !call_node->arguments) { return NULL; }

  pm_arguments_node_t* arguments = call_node->arguments;
  pm_node_t* last_argument = arguments->arguments.nodes[arguments->arguments.size - 1];

  if (last_argument->type != PM_KEYWORD_HASH_NODE) { return NULL; }

  pm_keyword_hash_node_t* hash = (pm_keyword_hash_node_t*) last_argument;
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, 64, allocator);
  bool first = true;

  for (size_t i = 0; i < hash->elements.size; i++) {
    pm_node_t* element = hash->elements.nodes[i];

    if (element->type != PM_ASSOC_NODE) { continue; }

    pm_assoc_node_t* assoc = (pm_assoc_node_t*) element;

    if (assoc->key->type != PM_SYMBOL_NODE) { continue; }

    pm_symbol_node_t* key_node = (pm_symbol_node_t*) assoc->key;
    size_t key_length = pm_string_length(&key_node->unescaped);
    const char* key_source = (const char*) pm_string_source(&key_node->unescaped);

    bool is_path_option = false;

    for (const char** option = JAVASCRIPT_INCLUDE_TAG_PATH_OPTIONS; *option != NULL; option++) {
      if (key_length == strlen(*option) &&
          strncmp(key_source, *option, key_length) == 0) {
        is_path_option = true;
        break;
      }
    }

    if (!is_path_option) { continue; }

    if (!first) { hb_buffer_append(&buffer, ", "); }
    first = false;

    size_t key_source_length = assoc->key->location.end - assoc->key->location.start;
    hb_buffer_append_with_length(&buffer, (const char*) assoc->key->location.start, key_source_length);
    hb_buffer_append(&buffer, " ");

    size_t value_source_length = assoc->value->location.end - assoc->value->location.start;
    hb_buffer_append_with_length(&buffer, (const char*) assoc->value->location.start, value_source_length);
  }

  if (first) {
    hb_buffer_free(&buffer);
    return NULL;
  }

  char* result = hb_allocator_strdup(allocator, hb_buffer_value(&buffer));
  hb_buffer_free(&buffer);

  return result;
}

static AST_NODE_T* remove_attribute_by_name(hb_array_T* attributes, const char* name) {
  if (!attributes) { return NULL; }

  for (size_t index = 0; index < hb_array_size(attributes); index++) {
    AST_NODE_T* attribute = hb_array_get(attributes, index);

    if (attribute->type != AST_HTML_ATTRIBUTE_NODE) { continue; }

    AST_HTML_ATTRIBUTE_NODE_T* html_attribute = (AST_HTML_ATTRIBUTE_NODE_T*) attribute;

    if (!html_attribute->name || !html_attribute->name->children || !hb_array_size(html_attribute->name->children)) {
      continue;
    }

    AST_LITERAL_NODE_T* literal = (AST_LITERAL_NODE_T*) hb_array_get(html_attribute->name->children, 0);

    if (hb_string_equals(literal->content, hb_string((char*) name))) {
      hb_array_remove(attributes, index);
      return attribute;
    }
  }

  return NULL;
}

static AST_NODE_T* transform_tag_helper_with_attributes(
  AST_ERB_CONTENT_NODE_T* erb_node,
  analyze_ruby_context_T* context,
  tag_helper_parse_context_T* parse_context
) {
  if (!erb_node || !context || !parse_context) { return NULL; }
  hb_allocator_T* allocator = context->allocator;
  const tag_helper_handler_T* handler = parse_context->matched_handler;

  char* tag_name = parse_context->info->tag_name ? hb_allocator_strdup(allocator, parse_context->info->tag_name) : NULL;

  position_T tag_name_start, tag_name_end;
  calculate_tag_name_positions(
    parse_context,
    erb_node->base.location.start,
    erb_node->base.location.end,
    &tag_name_start,
    &tag_name_end
  );

  hb_array_T* attributes = NULL;
  if (parse_context->info->call_node) {
    attributes = extract_html_attributes_from_call_node(
      parse_context->info->call_node,
      parse_context->prism_source,
      parse_context->original_source,
      parse_context->erb_content_offset,
      allocator
    );
  }

  if (attributes && handler->name
      && (strcmp(handler->name, "javascript_include_tag") == 0 || strcmp(handler->name, "javascript_tag") == 0)) {
    resolve_nonce_attribute(attributes, allocator);
  }

  char* path_options = NULL;

  if (attributes && handler->name && strcmp(handler->name, "javascript_include_tag") == 0) {
    path_options = extract_path_options_from_keyword_hash(parse_context->info->call_node, allocator);
    remove_attribute_by_name(attributes, "extname");
    remove_attribute_by_name(attributes, "host");
    remove_attribute_by_name(attributes, "protocol");
    remove_attribute_by_name(attributes, "skip_pipeline");
  }

  char* helper_content = NULL;
  bool content_is_ruby_expression = false;

  if (parse_context->info->call_node && handler->extract_content) {
    helper_content = handler->extract_content(parse_context->info->call_node, &parse_context->parser, allocator);

    if (helper_content) {
      pm_call_node_t* call = parse_context->info->call_node;

      if (call->arguments) {
        if (strcmp(handler->name, "content_tag") == 0 && call->arguments->arguments.size >= 2
            && call->arguments->arguments.nodes[1]->type != PM_KEYWORD_HASH_NODE) {
          content_is_ruby_expression = (call->arguments->arguments.nodes[1]->type != PM_STRING_NODE);
        } else if (strcmp(handler->name, "content_tag") != 0 && call->arguments->arguments.size >= 1
                   && call->arguments->arguments.nodes[0]->type != PM_KEYWORD_HASH_NODE) {
          content_is_ruby_expression = (call->arguments->arguments.nodes[0]->type != PM_STRING_NODE);
        }
      }

      if (!content_is_ruby_expression && call->block && call->block->type == PM_BLOCK_NODE) {
        pm_block_node_t* block_node = (pm_block_node_t*) call->block;

        if (block_node->body && block_node->body->type == PM_STATEMENTS_NODE) {
          pm_statements_node_t* statements = (pm_statements_node_t*) block_node->body;

          if (statements->body.size == 1) {
            content_is_ruby_expression = (statements->body.nodes[0]->type != PM_STRING_NODE);
          }
        }
      }
    }
  }

  if (detect_turbo_frame_tag(parse_context->info->call_node, &parse_context->parser)) {
    char* id_value = extract_turbo_frame_tag_id(parse_context->info->call_node, &parse_context->parser, allocator);

    if (id_value) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
      position_T id_start, id_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &id_start, &id_end);
      bool id_is_ruby_expression = (first_argument->type != PM_STRING_NODE && first_argument->type != PM_SYMBOL_NODE);

      AST_HTML_ATTRIBUTE_NODE_T* id_attribute =
        id_is_ruby_expression ? create_html_attribute_with_ruby_literal("id", id_value, id_start, id_end, allocator)
                              : create_html_attribute_node("id", id_value, id_start, id_end, allocator);

      if (id_attribute) {
        AST_NODE_T* src_node = remove_attribute_by_name(attributes, "src");
        AST_NODE_T* target_node = remove_attribute_by_name(attributes, "target");

        hb_array_append(attributes, (AST_NODE_T*) id_attribute);

        if (src_node) { hb_array_append(attributes, src_node); }
        if (target_node) { hb_array_append(attributes, target_node); }
      }

      hb_allocator_dealloc(allocator, id_value);
    }
  }

  if (detect_javascript_include_tag(parse_context->info->call_node, &parse_context->parser)
      && parse_context->info->call_node->arguments && parse_context->info->call_node->arguments->arguments.size >= 1) {
    char* source_value =
      extract_javascript_include_tag_src(parse_context->info->call_node, &parse_context->parser, allocator);

    if (source_value) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
      position_T source_start, source_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &source_start, &source_end);
      bool source_is_string = (first_argument->type == PM_STRING_NODE);

      size_t source_length = strlen(source_value);
      bool is_url = javascript_include_tag_source_is_url(source_value, source_length);

      char* source_attribute_value = source_value;
      if (source_is_string && !is_url) {
        size_t quoted_length = source_length + 2;
        char* quoted_source = hb_allocator_alloc(allocator, quoted_length + 1);
        quoted_source[0] = '"';
        memcpy(quoted_source + 1, source_value, source_length);
        quoted_source[quoted_length - 1] = '"';
        quoted_source[quoted_length] = '\0';

        source_attribute_value = wrap_in_javascript_path(quoted_source, quoted_length, path_options, allocator);
        hb_allocator_dealloc(allocator, quoted_source);
      }

      AST_HTML_ATTRIBUTE_NODE_T* source_attribute =
        is_url
          ? create_html_attribute_node("src", source_attribute_value, source_start, source_end, allocator)
          : create_html_attribute_with_ruby_literal("src", source_attribute_value, source_start, source_end, allocator);

      if (source_attribute) { hb_array_append(attributes, (AST_NODE_T*) source_attribute); }

      if (source_attribute_value != source_value) { hb_allocator_dealloc(allocator, source_attribute_value); }
      hb_allocator_dealloc(allocator, source_value);
    }
  }

  if (detect_image_tag(parse_context->info->call_node, &parse_context->parser)
      && parse_context->info->call_node->arguments && parse_context->info->call_node->arguments->arguments.size >= 1) {
    char* source_value = extract_image_tag_src(parse_context->info->call_node, &parse_context->parser, allocator);

    if (source_value) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
      position_T source_start, source_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &source_start, &source_end);
      bool source_is_string = (first_argument->type == PM_STRING_NODE);
      bool source_is_path_helper = is_route_helper_node(first_argument, &parse_context->parser);

      size_t source_length = strlen(source_value);
      bool is_url = image_tag_source_is_url(source_value, source_length);

      char* source_attribute_value = source_value;

      if (source_is_string && !is_url) {
        size_t quoted_length = source_length + 2;
        char* quoted_source = hb_allocator_alloc(allocator, quoted_length + 1);
        quoted_source[0] = '"';
        memcpy(quoted_source + 1, source_value, source_length);
        quoted_source[quoted_length - 1] = '"';
        quoted_source[quoted_length] = '\0';

        source_attribute_value = wrap_in_image_path(quoted_source, quoted_length, allocator);
        hb_allocator_dealloc(allocator, quoted_source);
      } else if (!source_is_string && !is_url && !source_is_path_helper) {
        source_attribute_value = wrap_in_image_path(source_value, source_length, allocator);
      }

      AST_HTML_ATTRIBUTE_NODE_T* source_attribute =
        is_url
          ? create_html_attribute_node("src", source_attribute_value, source_start, source_end, allocator)
          : create_html_attribute_with_ruby_literal("src", source_attribute_value, source_start, source_end, allocator);

      if (source_attribute) { hb_array_append(attributes, (AST_NODE_T*) source_attribute); }
      if (source_attribute_value != source_value) { hb_allocator_dealloc(allocator, source_attribute_value); }

      hb_allocator_dealloc(allocator, source_value);
    }
  }

  token_T* tag_name_token =
    tag_name ? create_synthetic_token(allocator, tag_name, TOKEN_IDENTIFIER, tag_name_start, tag_name_end) : NULL;

  hb_array_T* open_tag_children = attributes ? attributes : hb_array_init(0, allocator);

  AST_ERB_OPEN_TAG_NODE_T* open_tag_node = ast_erb_open_tag_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    tag_name_token,
    open_tag_children,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_T* body = hb_array_init(1, allocator);
  hb_array_T* element_errors = hb_array_init(0, allocator);
  bool is_void = tag_name && is_void_element(hb_string_from_c_string(tag_name))
              && (string_equals(handler->name, "tag") || string_equals(handler->name, "content_tag")
                  || string_equals(handler->name, "image_tag"));

  if (helper_content) {
    if (is_void && tag_name) {
      hb_buffer_T helper_name_buffer;
      hb_buffer_init(&helper_name_buffer, 64, allocator);

      if (string_equals(handler->name, "tag")) {
        hb_buffer_append(&helper_name_buffer, "tag.");
        hb_buffer_append(&helper_name_buffer, tag_name);
      } else {
        hb_buffer_append(&helper_name_buffer, handler->name);
        hb_buffer_append(&helper_name_buffer, " :");
        hb_buffer_append(&helper_name_buffer, tag_name);
      }

      hb_string_T helper_name = hb_string_from_c_string(hb_buffer_value(&helper_name_buffer));

      position_T content_start = erb_node->base.location.start;
      position_T content_end = erb_node->base.location.end;

      pm_call_node_t* call = parse_context->info->call_node;

      if (call && call->arguments) {
        size_t content_arg_index = string_equals(handler->name, "content_tag") ? 1 : 0;

        if (call->arguments->arguments.size > content_arg_index) {
          pm_node_t* content_node = call->arguments->arguments.nodes[content_arg_index];
          prism_node_location_to_positions(&content_node->location, parse_context, &content_start, &content_end);
        }
      }

      append_void_element_content_error(
        tag_name_token,
        helper_name,
        content_start,
        content_end,
        allocator,
        element_errors
      );
    }

    if (string_equals(handler->name, "javascript_tag")) {
      hb_array_T* cdata_children = hb_array_init(1, allocator);

      append_body_content_node(
        cdata_children,
        helper_content,
        content_is_ruby_expression,
        erb_node->base.location.start,
        erb_node->base.location.end,
        allocator
      );

      token_T* cdata_opening = create_synthetic_token(
        allocator,
        "\n//<![CDATA[\n",
        TOKEN_CDATA_START,
        erb_node->base.location.start,
        erb_node->base.location.end
      );

      token_T* cdata_closing = create_synthetic_token(
        allocator,
        "\n//]]>\n",
        TOKEN_CDATA_END,
        erb_node->base.location.start,
        erb_node->base.location.end
      );

      AST_CDATA_NODE_T* cdata_node = ast_cdata_node_init(
        cdata_opening,
        cdata_children,
        cdata_closing,
        erb_node->base.location.start,
        erb_node->base.location.end,
        hb_array_init(0, allocator),
        allocator
      );

      if (cdata_node) { hb_array_append(body, (AST_NODE_T*) cdata_node); }
    } else {
      append_body_content_node(
        body,
        helper_content,
        content_is_ruby_expression,
        erb_node->base.location.start,
        erb_node->base.location.end,
        allocator
      );
    }

    hb_allocator_dealloc(allocator, helper_content);
  }

  AST_NODE_T* close_tag = NULL;

  if (!is_void) {
    AST_HTML_VIRTUAL_CLOSE_TAG_NODE_T* virtual_close = ast_html_virtual_close_tag_node_init(
      tag_name_token,
      erb_node->base.location.end,
      erb_node->base.location.end,
      hb_array_init(0, allocator),
      allocator
    );
    close_tag = (AST_NODE_T*) virtual_close;
  }

  AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
    (AST_NODE_T*) open_tag_node,
    tag_name_token,
    body,
    close_tag,
    is_void,
    handler->source,
    erb_node->base.location.start,
    erb_node->base.location.end,
    element_errors,
    allocator
  );

  hb_allocator_dealloc(allocator, tag_name);
  return (AST_NODE_T*) element;
}

static size_t count_javascript_include_tag_sources(pm_call_node_t* call_node) {
  if (!call_node || !call_node->arguments) { return 0; }

  size_t count = 0;
  pm_arguments_node_t* arguments = call_node->arguments;

  for (size_t i = 0; i < arguments->arguments.size; i++) {
    pm_node_t* arg = arguments->arguments.nodes[i];
    if (arg->type == PM_KEYWORD_HASH_NODE) { break; }
    count++;
  }

  return count;
}

static AST_NODE_T* create_javascript_include_tag_element(
  AST_ERB_CONTENT_NODE_T* erb_node,
  tag_helper_parse_context_T* parse_context,
  pm_node_t* source_argument,
  hb_array_T* shared_attributes,
  const char* path_options,
  hb_allocator_T* allocator
) {
  position_T tag_name_start, tag_name_end;
  calculate_tag_name_positions(
    parse_context,
    erb_node->base.location.start,
    erb_node->base.location.end,
    &tag_name_start,
    &tag_name_end
  );

  token_T* tag_name_token = create_synthetic_token(allocator, "script", TOKEN_IDENTIFIER, tag_name_start, tag_name_end);

  char* source_value = NULL;
  bool source_is_string = (source_argument->type == PM_STRING_NODE);

  if (source_is_string) {
    pm_string_node_t* string_node = (pm_string_node_t*) source_argument;
    size_t length = pm_string_length(&string_node->unescaped);
    source_value = hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
  } else {
    size_t source_length = source_argument->location.end - source_argument->location.start;
    source_value = hb_allocator_strndup(allocator, (const char*) source_argument->location.start, source_length);
  }

  position_T source_start, source_end;
  prism_node_location_to_positions(&source_argument->location, parse_context, &source_start, &source_end);

  size_t source_length = strlen(source_value);
  bool is_url = javascript_include_tag_source_is_url(source_value, source_length);

  char* source_attribute_value = source_value;
  if (source_is_string && !is_url) {
    size_t quoted_length = source_length + 2;
    char* quoted_source = hb_allocator_alloc(allocator, quoted_length + 1);
    quoted_source[0] = '"';
    memcpy(quoted_source + 1, source_value, source_length);
    quoted_source[quoted_length - 1] = '"';
    quoted_source[quoted_length] = '\0';

    source_attribute_value = wrap_in_javascript_path(quoted_source, quoted_length, path_options, allocator);
    hb_allocator_dealloc(allocator, quoted_source);
  }

  hb_array_T* attributes = hb_array_init(hb_array_size(shared_attributes) + 1, allocator);

  AST_HTML_ATTRIBUTE_NODE_T* source_attribute =
    is_url
      ? create_html_attribute_node("src", source_attribute_value, source_start, source_end, allocator)
      : create_html_attribute_with_ruby_literal("src", source_attribute_value, source_start, source_end, allocator);
  if (source_attribute) { hb_array_append(attributes, source_attribute); }

  for (size_t i = 0; i < hb_array_size(shared_attributes); i++) {
    hb_array_append(attributes, hb_array_get(shared_attributes, i));
  }

  if (source_attribute_value != source_value) { hb_allocator_dealloc(allocator, source_attribute_value); }
  hb_allocator_dealloc(allocator, source_value);

  AST_ERB_OPEN_TAG_NODE_T* open_tag_node = ast_erb_open_tag_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    tag_name_token,
    attributes,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  AST_HTML_VIRTUAL_CLOSE_TAG_NODE_T* virtual_close = ast_html_virtual_close_tag_node_init(
    tag_name_token,
    erb_node->base.location.end,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  return (AST_NODE_T*) ast_html_element_node_init(
    (AST_NODE_T*) open_tag_node,
    tag_name_token,
    hb_array_init(0, allocator),
    (AST_NODE_T*) virtual_close,
    false,
    parse_context->matched_handler->source,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );
}

static hb_array_T* transform_javascript_include_tag_multi_source(
  AST_ERB_CONTENT_NODE_T* erb_node,
  analyze_ruby_context_T* context,
  tag_helper_parse_context_T* parse_context
) {
  hb_allocator_T* allocator = context->allocator;
  pm_call_node_t* call_node = parse_context->info->call_node;
  size_t source_count = count_javascript_include_tag_sources(call_node);

  if (source_count == 0) { return NULL; }

  hb_array_T* shared_attributes = extract_html_attributes_from_call_node(
    call_node,
    parse_context->prism_source,
    parse_context->original_source,
    parse_context->erb_content_offset,
    allocator
  );
  if (!shared_attributes) { shared_attributes = hb_array_init(0, allocator); }

  resolve_nonce_attribute(shared_attributes, allocator);

  char* path_options = extract_path_options_from_keyword_hash(call_node, allocator);
  remove_attribute_by_name(shared_attributes, "extname");
  remove_attribute_by_name(shared_attributes, "host");
  remove_attribute_by_name(shared_attributes, "protocol");
  remove_attribute_by_name(shared_attributes, "skip_pipeline");

  hb_array_T* elements = hb_array_init(source_count * 2, allocator);

  for (size_t i = 0; i < source_count; i++) {
    pm_node_t* source_arg = call_node->arguments->arguments.nodes[i];
    AST_NODE_T* element =
      create_javascript_include_tag_element(erb_node, parse_context, source_arg, shared_attributes, path_options, allocator);

    if (element) {
      if (hb_array_size(elements) > 0) {
        position_T position = erb_node->base.location.start;
        AST_HTML_TEXT_NODE_T* newline = ast_html_text_node_init(
          hb_string_from_c_string("\n"),
          position,
          position,
          hb_array_init(0, allocator),
          allocator
        );
        if (newline) { hb_array_append(elements, (AST_NODE_T*) newline); }
      }

      hb_array_append(elements, element);
    }
  }

  return elements;
}

static bool erb_content_is_end_keyword(hb_string_T content) {
  const char* start = content.data;
  const char* end = content.data + content.length;

  while (start < end && is_whitespace(*start)) {
    start++;
  }

  while (end > start && is_whitespace(*(end - 1))) {
    end--;
  }

  return (size_t) (end - start) == 3 && start[0] == 'e' && start[1] == 'n' && start[2] == 'd';
}

static AST_ERB_CONTENT_NODE_T* find_swallowed_erb_end_node(hb_array_T* nodes) {
  if (!nodes) { return NULL; }

  for (size_t i = 0; i < hb_array_size(nodes); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(nodes, i);
    if (!node) { continue; }

    if (node->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* erb = (AST_ERB_CONTENT_NODE_T*) node;
      if (erb->content && erb_content_is_end_keyword(erb->content->value)) { return erb; }
    }

    if (node->type == AST_HTML_OPEN_TAG_NODE) {
      AST_ERB_CONTENT_NODE_T* found = find_swallowed_erb_end_node(((AST_HTML_OPEN_TAG_NODE_T*) node)->children);
      if (found) { return found; }
    }
  }

  return NULL;
}

static AST_NODE_T* transform_erb_block_to_tag_helper(
  AST_ERB_BLOCK_NODE_T* block_node,
  analyze_ruby_context_T* context,
  tag_helper_parse_context_T* parse_context
) {
  if (!block_node || !context || !parse_context) { return NULL; }
  hb_allocator_T* allocator = context->allocator;

  char* tag_name = parse_context->info->tag_name ? hb_allocator_strdup(allocator, parse_context->info->tag_name) : NULL;

  position_T tag_name_start, tag_name_end;
  calculate_tag_name_positions(
    parse_context,
    block_node->base.location.start,
    block_node->base.location.end,
    &tag_name_start,
    &tag_name_end
  );

  hb_array_T* attributes = NULL;

  if (parse_context->info->call_node) {
    attributes = extract_html_attributes_from_call_node(
      parse_context->info->call_node,
      parse_context->prism_source,
      parse_context->original_source,
      parse_context->erb_content_offset,
      allocator
    );
  }

  if (attributes && parse_context->matched_handler && parse_context->matched_handler->name
      && (strcmp(parse_context->matched_handler->name, "javascript_include_tag") == 0
          || strcmp(parse_context->matched_handler->name, "javascript_tag") == 0)) {
    resolve_nonce_attribute(attributes, allocator);
  }

  if (detect_link_to(parse_context->info->call_node, &parse_context->parser)
      && parse_context->info->call_node->arguments && parse_context->info->call_node->arguments->arguments.size >= 1) {
    pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
    size_t source_length = first_argument->location.end - first_argument->location.start;
    char* href = NULL;

    if (first_argument->type != PM_STRING_NODE && !is_route_helper_node(first_argument, &parse_context->parser)) {
      href = wrap_in_url_for((const char*) first_argument->location.start, source_length, allocator);
    } else {
      href = hb_allocator_strndup(allocator, (const char*) first_argument->location.start, source_length);
    }

    if (href) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      position_T href_start, href_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &href_start, &href_end);
      bool href_is_ruby_expression = (first_argument->type != PM_STRING_NODE);

      if (first_argument->type == PM_STRING_NODE) {
        hb_allocator_dealloc(allocator, href);
        pm_string_node_t* string_node = (pm_string_node_t*) first_argument;
        size_t length = pm_string_length(&string_node->unescaped);
        href = hb_allocator_strndup(allocator, (const char*) pm_string_source(&string_node->unescaped), length);
      }

      AST_HTML_ATTRIBUTE_NODE_T* href_attribute =
        create_href_attribute(href, href_is_ruby_expression, href_start, href_end, allocator);

      if (href_attribute) { hb_array_append(attributes, (AST_NODE_T*) href_attribute); }

      hb_allocator_dealloc(allocator, href);
    }
  }

  if (detect_turbo_frame_tag(parse_context->info->call_node, &parse_context->parser)) {
    char* id_value = extract_turbo_frame_tag_id(parse_context->info->call_node, &parse_context->parser, allocator);

    if (id_value) {
      if (!attributes) { attributes = hb_array_init(4, allocator); }

      pm_node_t* first_argument = parse_context->info->call_node->arguments->arguments.nodes[0];
      position_T id_start, id_end;
      prism_node_location_to_positions(&first_argument->location, parse_context, &id_start, &id_end);
      bool id_is_ruby_expression = (first_argument->type != PM_STRING_NODE && first_argument->type != PM_SYMBOL_NODE);

      AST_HTML_ATTRIBUTE_NODE_T* id_attribute =
        id_is_ruby_expression ? create_html_attribute_with_ruby_literal("id", id_value, id_start, id_end, allocator)
                              : create_html_attribute_node("id", id_value, id_start, id_end, allocator);

      if (id_attribute) {
        AST_NODE_T* src_node = remove_attribute_by_name(attributes, "src");
        AST_NODE_T* target_node = remove_attribute_by_name(attributes, "target");

        hb_array_append(attributes, (AST_NODE_T*) id_attribute);

        if (src_node) { hb_array_append(attributes, src_node); }
        if (target_node) { hb_array_append(attributes, target_node); }
      }

      hb_allocator_dealloc(allocator, id_value);
    }
  }

  token_T* tag_name_token =
    tag_name ? create_synthetic_token(allocator, tag_name, TOKEN_IDENTIFIER, tag_name_start, tag_name_end) : NULL;

  hb_array_T* open_tag_children = attributes ? attributes : hb_array_init(0, allocator);

  AST_ERB_OPEN_TAG_NODE_T* open_tag_node = ast_erb_open_tag_node_init(
    block_node->tag_opening,
    block_node->content,
    block_node->tag_closing,
    tag_name_token,
    open_tag_children,
    block_node->tag_opening->location.start,
    block_node->tag_closing->location.end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_T* body = block_node->body ? block_node->body : hb_array_init(0, allocator);
  AST_NODE_T* close_tag = (AST_NODE_T*) block_node->end_node;
  position_T element_end = block_node->base.location.end;

  if (tag_name && parser_is_foreign_content_tag(hb_string_from_c_string(tag_name)) && context->source
      && block_node->body && hb_array_size(block_node->body) > 0) {
    size_t start_offset = block_node->tag_closing->range.to;
    size_t end_offset = 0;

    if (block_node->end_node && block_node->end_node->tag_opening) {
      end_offset = block_node->end_node->tag_opening->range.from;
    } else {
      AST_ERB_CONTENT_NODE_T* swallowed_end = find_swallowed_erb_end_node(block_node->body);

      if (swallowed_end && swallowed_end->tag_opening) {
        end_offset = swallowed_end->tag_opening->range.from;

        AST_ERB_END_NODE_T* end_node = ast_erb_end_node_init(
          swallowed_end->tag_opening,
          swallowed_end->content,
          swallowed_end->tag_closing,
          swallowed_end->base.location.start,
          swallowed_end->base.location.end,
          hb_array_init(0, allocator),
          allocator
        );

        close_tag = (AST_NODE_T*) end_node;
        element_end = close_tag->location.end;
      }
    }

    if (end_offset > start_offset) {
      position_T body_start = block_node->tag_closing->location.end;

      size_t content_length = end_offset - start_offset;
      char* raw_copy = hb_allocator_strndup(allocator, context->source + start_offset, content_length);

      parser_options_T body_options = HERB_DEFAULT_PARSER_OPTIONS;
      body_options.html = false;
      body_options.analyze = false;
      body_options.strict = false;
      body_options.start_line = body_start.line;
      body_options.start_column = body_start.column;

      AST_DOCUMENT_NODE_T* body_document = herb_parse(raw_copy, &body_options, allocator);
      body = body_document->children;
    }
  }

  AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
    (AST_NODE_T*) open_tag_node,
    tag_name_token,
    body,
    close_tag,
    false,
    parse_context->matched_handler->source,
    block_node->base.location.start,
    element_end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_allocator_dealloc(allocator, tag_name);
  return (AST_NODE_T*) element;
}

static AST_NODE_T* transform_link_to_helper(
  AST_ERB_CONTENT_NODE_T* erb_node,
  analyze_ruby_context_T* context,
  tag_helper_parse_context_T* parse_context
) {
  if (!erb_node || !context || !parse_context) { return NULL; }
  hb_allocator_T* allocator = context->allocator;
  tag_helper_info_T* info = parse_context->info;

  char* href = extract_link_to_href(info->call_node, &parse_context->parser, allocator);

  hb_array_T* attributes = NULL;
  pm_arguments_node_t* link_arguments = info->call_node->arguments;
  bool has_inline_block = info->call_node->block && info->call_node->block->type == PM_BLOCK_NODE;

  bool second_arg_is_hash = link_arguments && link_arguments->arguments.size == 2
                         && (link_arguments->arguments.nodes[1]->type == PM_KEYWORD_HASH_NODE
                             || link_arguments->arguments.nodes[1]->type == PM_HASH_NODE);
  bool keyword_hash_is_url = !has_inline_block && second_arg_is_hash;

  if (!keyword_hash_is_url) {
    attributes = extract_html_attributes_from_call_node(
      info->call_node,
      parse_context->prism_source,
      parse_context->original_source,
      parse_context->erb_content_offset,
      allocator
    );
  }

  if (!attributes) { attributes = hb_array_init(4, allocator); }

  if (has_inline_block && link_arguments && link_arguments->arguments.size >= 2) {
    pm_node_t* second_arg = link_arguments->arguments.nodes[1];

    if (second_arg->type != PM_KEYWORD_HASH_NODE && second_arg->type != PM_HASH_NODE
        && second_arg->type != PM_STRING_NODE && second_arg->type != PM_SYMBOL_NODE) {
      size_t source_length = second_arg->location.end - second_arg->location.start;
      char* content = hb_allocator_strndup(allocator, (const char*) second_arg->location.start, source_length);

      if (content) {
        position_T position = prism_location_to_position_with_offset(
          &second_arg->location,
          parse_context->original_source,
          parse_context->erb_content_offset,
          parse_context->prism_source
        );

        AST_RUBY_HTML_ATTRIBUTES_SPLAT_NODE_T* splat_node = ast_ruby_html_attributes_splat_node_init(
          hb_string_from_c_string(content),
          HB_STRING_EMPTY,
          position,
          position,
          hb_array_init(0, allocator),
          allocator
        );

        if (splat_node) { hb_array_append(attributes, (AST_NODE_T*) splat_node); }

        hb_allocator_dealloc(allocator, content);
      }
    }
  }

  // `method:` implies `rel="nofollow"`
  bool has_data_method = false;
  hb_string_T data_method_string = hb_string("data-method");

  for (size_t i = 0; i < hb_array_size(attributes); i++) {
    AST_NODE_T* node = (AST_NODE_T*) hb_array_get(attributes, i);

    if (node->type != AST_HTML_ATTRIBUTE_NODE) { continue; }

    AST_HTML_ATTRIBUTE_NODE_T* attribute = (AST_HTML_ATTRIBUTE_NODE_T*) node;

    if (!attribute->name || !attribute->name->children || !hb_array_size(attribute->name->children)) { continue; }

    AST_LITERAL_NODE_T* literal = (AST_LITERAL_NODE_T*) hb_array_get(attribute->name->children, 0);

    if (hb_string_equals(literal->content, data_method_string)) {
      has_data_method = true;
      break;
    }
  }

  if (has_data_method) {
    position_T rel_position = erb_node->base.location.start;

    AST_HTML_ATTRIBUTE_NODE_T* rel_attribute =
      create_html_attribute_node("rel", "nofollow", rel_position, rel_position, allocator);

    if (rel_attribute) { hb_array_append(attributes, rel_attribute); }
  }

  char* href_for_body = NULL;
  bool href_for_body_is_ruby_expression = false;

  if (href) {
    position_T href_start = erb_node->content->location.start;
    position_T href_end = href_start;
    bool href_is_ruby_expression = true;

    if (info->call_node && info->call_node->arguments) {
      pm_arguments_node_t* arguments = info->call_node->arguments;
      pm_node_t* href_argument = NULL;

      if (has_inline_block) {
        if (arguments->arguments.size >= 1) {
          href_argument = arguments->arguments.nodes[0];
          href_is_ruby_expression = (href_argument->type != PM_STRING_NODE);
        }
      } else if (arguments->arguments.size >= 2) {
        href_argument = arguments->arguments.nodes[1];
        href_is_ruby_expression = (href_argument->type != PM_STRING_NODE);
      } else if (arguments->arguments.size == 1) {
        href_argument = arguments->arguments.nodes[0];
        href_is_ruby_expression = true;
      }

      if (href_argument) {
        prism_node_location_to_positions(&href_argument->location, parse_context, &href_start, &href_end);
      }
    }

    AST_HTML_ATTRIBUTE_NODE_T* href_attribute =
      create_href_attribute(href, href_is_ruby_expression, href_start, href_end, allocator);

    if (href_attribute) { hb_array_append(attributes, (AST_NODE_T*) href_attribute); }
    if (!info->content) {
      href_for_body = hb_allocator_strdup(allocator, href);
      href_for_body_is_ruby_expression = href_is_ruby_expression;
    }

    hb_allocator_dealloc(allocator, href);
  }

  position_T tag_name_start, tag_name_end;
  calculate_tag_name_positions(
    parse_context,
    erb_node->base.location.start,
    erb_node->base.location.end,
    &tag_name_start,
    &tag_name_end
  );

  token_T* tag_name_token = create_synthetic_token(allocator, "a", TOKEN_IDENTIFIER, tag_name_start, tag_name_end);

  AST_ERB_OPEN_TAG_NODE_T* open_tag_node = ast_erb_open_tag_node_init(
    erb_node->tag_opening,
    erb_node->content,
    erb_node->tag_closing,
    tag_name_token,
    attributes,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  hb_array_T* body = hb_array_init(1, allocator);

  if (info->content) {
    bool content_is_ruby_expression = false;

    if (has_inline_block && info->call_node->block && info->call_node->block->type == PM_BLOCK_NODE) {
      pm_block_node_t* block_node = (pm_block_node_t*) info->call_node->block;

      if (block_node->body && block_node->body->type == PM_STATEMENTS_NODE) {
        pm_statements_node_t* statements = (pm_statements_node_t*) block_node->body;

        if (statements->body.size == 1) {
          content_is_ruby_expression = (statements->body.nodes[0]->type != PM_STRING_NODE);
        }
      }
    } else if (info->call_node && info->call_node->arguments && info->call_node->arguments->arguments.size >= 1) {
      pm_node_t* first_argument = info->call_node->arguments->arguments.nodes[0];
      content_is_ruby_expression = (first_argument->type != PM_STRING_NODE);
    }

    append_body_content_node(
      body,
      info->content,
      content_is_ruby_expression,
      erb_node->base.location.start,
      erb_node->base.location.end,
      allocator
    );
  } else if (href_for_body) {
    append_body_content_node(
      body,
      href_for_body,
      href_for_body_is_ruby_expression,
      erb_node->base.location.start,
      erb_node->base.location.end,
      allocator
    );

    hb_allocator_dealloc(allocator, href_for_body);
  }

  AST_HTML_VIRTUAL_CLOSE_TAG_NODE_T* virtual_close = ast_html_virtual_close_tag_node_init(
    tag_name_token,
    erb_node->base.location.end,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  AST_HTML_ELEMENT_NODE_T* element = ast_html_element_node_init(
    (AST_NODE_T*) open_tag_node,
    tag_name_token,
    body,
    (AST_NODE_T*) virtual_close,
    false,
    parse_context->matched_handler->source,
    erb_node->base.location.start,
    erb_node->base.location.end,
    hb_array_init(0, allocator),
    allocator
  );

  return (AST_NODE_T*) element;
}

void transform_tag_helper_array(hb_array_T* array, analyze_ruby_context_T* context) {
  if (!array || !context) { return; }

  for (size_t i = 0; i < hb_array_size(array); i++) {
    AST_NODE_T* child = hb_array_get(array, i);
    if (!child) { continue; }

    AST_NODE_T* replacement = NULL;

    if (child->type == AST_ERB_BLOCK_NODE) {
      AST_ERB_BLOCK_NODE_T* block_node = (AST_ERB_BLOCK_NODE_T*) child;
      token_T* block_content = block_node->content;

      if (block_content && !hb_string_is_empty(block_content->value)) {
        char* block_string = hb_string_to_c_string_using_malloc(block_content->value);
        size_t erb_content_offset = 0;

        if (context->source) {
          erb_content_offset = calculate_byte_offset_from_position(context->source, block_content->location.start);
        }

        tag_helper_parse_context_T* parse_context =
          parse_tag_helper_content(block_string, context->source, erb_content_offset, context->allocator);

        if (parse_context) {
          replacement = transform_erb_block_to_tag_helper(block_node, context, parse_context);
          replacement = wrap_in_conditional_if_needed(replacement, parse_context, context->allocator);
          free_tag_helper_parse_context(parse_context);
        }

        free(block_string);
      }
    } else if (child->type == AST_ERB_CONTENT_NODE) {
      AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) child;
      token_T* tag_opening = erb_node->tag_opening;

      if (tag_opening && !hb_string_is_empty(tag_opening->value)) {
        const char* opening_string = tag_opening->value.data;

        if (opening_string && strstr(opening_string, "#") != NULL) { continue; }
      }

      token_T* erb_content = erb_node->content;

      if (erb_content && !hb_string_is_empty(erb_content->value)) {
        char* erb_string = hb_string_to_c_string_using_malloc(erb_content->value);
        size_t erb_content_offset = 0;

        if (context->source) {
          erb_content_offset = calculate_byte_offset_from_position(context->source, erb_content->location.start);
        }

        tag_helper_parse_context_T* parse_context =
          parse_tag_helper_content(erb_string, context->source, erb_content_offset, context->allocator);

        if (parse_context) {
          if (strcmp(parse_context->matched_handler->name, "javascript_include_tag") == 0
              && parse_context->info->call_node
              && count_javascript_include_tag_sources(parse_context->info->call_node) > 1) {
            hb_array_T* multi = transform_javascript_include_tag_multi_source(erb_node, context, parse_context);

            if (multi && hb_array_size(multi) > 0) {
              size_t old_size = hb_array_size(array);
              size_t multi_size = hb_array_size(multi);
              hb_array_T* new_array = hb_array_init(old_size - 1 + multi_size, context->allocator);

              for (size_t j = 0; j < old_size; j++) {
                if (j == i) {
                  for (size_t k = 0; k < multi_size; k++) {
                    hb_array_append(new_array, hb_array_get(multi, k));
                  }
                } else {
                  hb_array_append(new_array, hb_array_get(array, j));
                }
              }

              array->items = new_array->items;
              array->size = new_array->size;
              array->capacity = new_array->capacity;

              i += multi_size - 1;
            }
          } else if (strcmp(parse_context->matched_handler->name, "link_to") == 0) {
            replacement = transform_link_to_helper(erb_node, context, parse_context);
          } else if (string_equals(parse_context->matched_handler->name, "tag") && parse_context->info->tag_name
                     && string_equals(parse_context->info->tag_name, "attributes")) {
            hb_array_T* attributes = NULL;

            if (parse_context->info->call_node) {
              attributes = extract_html_attributes_from_call_node(
                parse_context->info->call_node,
                parse_context->prism_source,
                parse_context->original_source,
                parse_context->erb_content_offset,
                context->allocator
              );
            }

            if (attributes && hb_array_size(attributes) > 0) {
              size_t old_size = hb_array_size(array);
              size_t attributes_size = hb_array_size(attributes);
              hb_array_T* new_array = hb_array_init(old_size - 1 + attributes_size, context->allocator);

              for (size_t j = 0; j < old_size; j++) {
                if (j == i) {
                  for (size_t k = 0; k < attributes_size; k++) {
                    hb_array_append(new_array, hb_array_get(attributes, k));
                  }
                } else {
                  hb_array_append(new_array, hb_array_get(array, j));
                }
              }

              array->items = new_array->items;
              array->size = new_array->size;
              array->capacity = new_array->capacity;

              i += attributes_size - 1;
            }
          } else {
            replacement = transform_tag_helper_with_attributes(erb_node, context, parse_context);
          }

          replacement = wrap_in_conditional_if_needed(replacement, parse_context, context->allocator);
          free_tag_helper_parse_context(parse_context);
        }

        free(erb_string);
      }
    } else if (child->type == AST_HTML_ATTRIBUTE_NODE) {
      AST_HTML_ATTRIBUTE_NODE_T* attribute_node = (AST_HTML_ATTRIBUTE_NODE_T*) child;

      if (attribute_node->name && !attribute_node->equals && !attribute_node->value && attribute_node->name->children
          && hb_array_size(attribute_node->name->children) == 1) {
        AST_NODE_T* name_child = hb_array_get(attribute_node->name->children, 0);

        if (name_child && name_child->type == AST_ERB_CONTENT_NODE) {
          AST_ERB_CONTENT_NODE_T* erb_node = (AST_ERB_CONTENT_NODE_T*) name_child;
          token_T* erb_content = erb_node->content;

          if (erb_content && !hb_string_is_empty(erb_content->value)) {
            char* erb_string = hb_string_to_c_string_using_malloc(erb_content->value);
            size_t erb_content_offset = 0;

            if (context->source) {
              erb_content_offset = calculate_byte_offset_from_position(context->source, erb_content->location.start);
            }

            tag_helper_parse_context_T* parse_context =
              parse_tag_helper_content(erb_string, context->source, erb_content_offset, context->allocator);

            if (parse_context && string_equals(parse_context->matched_handler->name, "tag")
                && parse_context->info->tag_name && string_equals(parse_context->info->tag_name, "attributes")) {
              hb_array_T* attributes = NULL;

              if (parse_context->info->call_node) {
                attributes = extract_html_attributes_from_call_node(
                  parse_context->info->call_node,
                  parse_context->prism_source,
                  parse_context->original_source,
                  parse_context->erb_content_offset,
                  context->allocator
                );
              }

              if (attributes && hb_array_size(attributes) > 0) {
                size_t old_size = hb_array_size(array);
                size_t attributes_size = hb_array_size(attributes);
                hb_array_T* new_array = hb_array_init(old_size - 1 + attributes_size, context->allocator);

                for (size_t j = 0; j < old_size; j++) {
                  if (j == i) {
                    for (size_t k = 0; k < attributes_size; k++) {
                      hb_array_append(new_array, hb_array_get(attributes, k));
                    }
                  } else {
                    hb_array_append(new_array, hb_array_get(array, j));
                  }
                }

                array->items = new_array->items;
                array->size = new_array->size;
                array->capacity = new_array->capacity;

                i += attributes_size - 1;
              }

              free_tag_helper_parse_context(parse_context);
            } else if (parse_context) {
              free_tag_helper_parse_context(parse_context);
            }

            free(erb_string);
          }
        }
      }
    }

    if (replacement) {
      position_T replacement_end = replacement->location.end;
      position_T original_end = child->location.end;
      bool has_trailing = replacement_end.line != original_end.line || replacement_end.column != original_end.column;

      if (has_trailing && context->source && child->type == AST_ERB_BLOCK_NODE) {
        AST_HTML_ELEMENT_NODE_T* element = (AST_HTML_ELEMENT_NODE_T*) replacement;

        if (replacement->type == AST_ERB_IF_NODE) {
          AST_ERB_IF_NODE_T* if_node = (AST_ERB_IF_NODE_T*) replacement;

          if (if_node->statements && hb_array_size(if_node->statements) > 0) {
            element = (AST_HTML_ELEMENT_NODE_T*) hb_array_get(if_node->statements, 0);
          }
        } else if (replacement->type == AST_ERB_UNLESS_NODE) {
          AST_ERB_UNLESS_NODE_T* unless_node = (AST_ERB_UNLESS_NODE_T*) replacement;

          if (unless_node->statements && hb_array_size(unless_node->statements) > 0) {
            element = (AST_HTML_ELEMENT_NODE_T*) hb_array_get(unless_node->statements, 0);
          }
        }

        if (element->close_tag && element->close_tag->type == AST_ERB_END_NODE) {
          AST_ERB_END_NODE_T* close_erb = (AST_ERB_END_NODE_T*) element->close_tag;
          size_t trailing_start = close_erb->tag_closing->range.to;
          size_t source_length = strlen(context->source);
          size_t trailing_end = trailing_start;

          while (trailing_end < source_length) {
            position_T position = position_from_source_with_offset(context->source, trailing_end);

            if (position.line > original_end.line
                || (position.line == original_end.line && position.column >= original_end.column)) {
              break;
            }

            trailing_end++;
          }

          if (trailing_end > trailing_start) {
            hb_string_T trailing_content =
              hb_string_from_data(context->source + trailing_start, trailing_end - trailing_start);
            AST_HTML_TEXT_NODE_T* trailing_text = ast_html_text_node_init(
              trailing_content,
              replacement_end,
              original_end,
              hb_array_init(0, context->allocator),
              context->allocator
            );

            size_t old_size = hb_array_size(array);
            hb_array_T* new_array = hb_array_init(old_size + 1, context->allocator);

            for (size_t j = 0; j < old_size; j++) {
              if (j == i) {
                hb_array_append(new_array, replacement);
                hb_array_append(new_array, trailing_text);
              } else {
                hb_array_append(new_array, hb_array_get(array, j));
              }
            }

            array->items = new_array->items;
            array->size = new_array->size;
            array->capacity = new_array->capacity;
            i++;
            continue;
          }
        }
      }

      hb_array_set(array, i, replacement);
    }
  }
}

void transform_tag_helper_blocks(const AST_NODE_T* node, analyze_ruby_context_T* context) {
  if (!node || !context) { return; }

  switch (node->type) {
    case AST_DOCUMENT_NODE: transform_tag_helper_array(((AST_DOCUMENT_NODE_T*) node)->children, context); break;
    case AST_HTML_ELEMENT_NODE: transform_tag_helper_array(((AST_HTML_ELEMENT_NODE_T*) node)->body, context); break;
    case AST_HTML_CONDITIONAL_ELEMENT_NODE:
      transform_tag_helper_array(((AST_HTML_CONDITIONAL_ELEMENT_NODE_T*) node)->body, context);
      break;
    case AST_HTML_OPEN_TAG_NODE:
      transform_tag_helper_array(((AST_HTML_OPEN_TAG_NODE_T*) node)->children, context);
      break;
    case AST_HTML_ATTRIBUTE_VALUE_NODE:
      transform_tag_helper_array(((AST_HTML_ATTRIBUTE_VALUE_NODE_T*) node)->children, context);
      break;
    case AST_ERB_BLOCK_NODE: transform_tag_helper_array(((AST_ERB_BLOCK_NODE_T*) node)->body, context); break;
    case AST_ERB_IF_NODE: transform_tag_helper_array(((AST_ERB_IF_NODE_T*) node)->statements, context); break;
    case AST_ERB_ELSE_NODE: transform_tag_helper_array(((AST_ERB_ELSE_NODE_T*) node)->statements, context); break;
    case AST_ERB_UNLESS_NODE: transform_tag_helper_array(((AST_ERB_UNLESS_NODE_T*) node)->statements, context); break;
    case AST_ERB_CASE_NODE:
      transform_tag_helper_array(((AST_ERB_CASE_NODE_T*) node)->children, context);
      transform_tag_helper_array(((AST_ERB_CASE_NODE_T*) node)->conditions, context);
      break;
    case AST_ERB_CASE_MATCH_NODE:
      transform_tag_helper_array(((AST_ERB_CASE_MATCH_NODE_T*) node)->children, context);
      transform_tag_helper_array(((AST_ERB_CASE_MATCH_NODE_T*) node)->conditions, context);
      break;
    case AST_ERB_WHEN_NODE: transform_tag_helper_array(((AST_ERB_WHEN_NODE_T*) node)->statements, context); break;
    case AST_ERB_WHILE_NODE: transform_tag_helper_array(((AST_ERB_WHILE_NODE_T*) node)->statements, context); break;
    case AST_ERB_UNTIL_NODE: transform_tag_helper_array(((AST_ERB_UNTIL_NODE_T*) node)->statements, context); break;
    case AST_ERB_FOR_NODE: transform_tag_helper_array(((AST_ERB_FOR_NODE_T*) node)->statements, context); break;
    case AST_ERB_BEGIN_NODE: transform_tag_helper_array(((AST_ERB_BEGIN_NODE_T*) node)->statements, context); break;
    case AST_ERB_RESCUE_NODE: transform_tag_helper_array(((AST_ERB_RESCUE_NODE_T*) node)->statements, context); break;
    case AST_ERB_ENSURE_NODE: transform_tag_helper_array(((AST_ERB_ENSURE_NODE_T*) node)->statements, context); break;
    case AST_ERB_IN_NODE: transform_tag_helper_array(((AST_ERB_IN_NODE_T*) node)->statements, context); break;
    default: break;
  }
}

bool transform_tag_helper_nodes(const AST_NODE_T* node, void* data) {
  analyze_ruby_context_T* context = (analyze_ruby_context_T*) data;

  transform_tag_helper_blocks(node, context);

  herb_visit_child_nodes(node, transform_tag_helper_nodes, data);

  return false;
}

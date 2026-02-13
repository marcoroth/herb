#include "include/herb.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/util/hb_array.h"
#include "include/util/hb_buffer.h"
#include "include/util/string.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

const herb_extract_ruby_options_T HERB_EXTRACT_RUBY_DEFAULT_OPTIONS = {
  .semicolons = true,
  .comments = false,
  .preserve_positions = true
};

void herb_extract_ruby_to_buffer_with_options(
  const char* source,
  hb_buffer_T* output,
  const herb_extract_ruby_options_T* options
) {
  herb_extract_ruby_options_T extract_options = options ? *options : HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;

  hb_array_T* tokens = herb_lex(source);
  bool skip_erb_content = false;
  bool is_comment_tag = false;
  bool is_erb_comment_tag = false;
  bool need_newline = false;

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    const token_T* token = hb_array_get(tokens, i);

    switch (token->type) {
      case TOKEN_NEWLINE: {
        hb_buffer_append(output, token->value);
        need_newline = false;
        break;
      }

      case TOKEN_ERB_START: {
        is_erb_comment_tag = string_equals(token->value, "<%#");

        if (is_erb_comment_tag) {
          if (extract_options.comments) {
            skip_erb_content = false;
            is_comment_tag = false;

            if (extract_options.preserve_positions) {
              hb_buffer_append_whitespace(output, 2);
              hb_buffer_append_char(output, '#');
            } else {
              if (need_newline) { hb_buffer_append_char(output, '\n'); }
              hb_buffer_append_char(output, '#');
              need_newline = true;
            }
          } else {
            skip_erb_content = true;
            is_comment_tag = true;
            if (extract_options.preserve_positions) { hb_buffer_append_whitespace(output, range_length(token->range)); }
          }
        } else if (string_equals(token->value, "<%%") || string_equals(token->value, "<%%=")
                   || string_equals(token->value, "<%graphql")) {
          skip_erb_content = true;
          is_comment_tag = false;
          if (extract_options.preserve_positions) { hb_buffer_append_whitespace(output, range_length(token->range)); }
        } else {
          skip_erb_content = false;
          is_comment_tag = false;

          if (extract_options.preserve_positions) {
            hb_buffer_append_whitespace(output, range_length(token->range));
          } else if (need_newline) {
            hb_buffer_append_char(output, '\n');
            need_newline = false;
          }
        }

        break;
      }

      case TOKEN_ERB_CONTENT: {
        if (skip_erb_content == false) {
          bool is_inline_comment = false;

          if (!extract_options.comments && !is_comment_tag && token->value != NULL) {
            const char* content = token->value;

            while (*content == ' ' || *content == '\t') {
              content++;
            }

            if (*content == '#' && token->location.start.line == token->location.end.line) {
              is_comment_tag = true;
              is_inline_comment = true;
            }
          }

          if (is_inline_comment) {
            if (extract_options.preserve_positions) { hb_buffer_append_whitespace(output, range_length(token->range)); }
          } else {
            hb_buffer_append(output, token->value);
            if (!extract_options.preserve_positions) { need_newline = true; }
          }
        } else {
          if (extract_options.preserve_positions) { hb_buffer_append_whitespace(output, range_length(token->range)); }
        }

        break;
      }

      case TOKEN_ERB_END: {
        bool was_comment = is_comment_tag;
        bool was_erb_comment = is_erb_comment_tag;
        skip_erb_content = false;
        is_comment_tag = false;
        is_erb_comment_tag = false;

        if (extract_options.preserve_positions) {
          if (was_comment) {
            hb_buffer_append_whitespace(output, range_length(token->range));
          } else if (was_erb_comment && extract_options.comments) {
            hb_buffer_append_whitespace(output, range_length(token->range));
          } else if (extract_options.semicolons) {
            hb_buffer_append_char(output, ' ');
            hb_buffer_append_char(output, ';');
            hb_buffer_append_whitespace(output, range_length(token->range) - 2);
          } else {
            hb_buffer_append_whitespace(output, range_length(token->range));
          }
        }

        break;
      }

      default: {
        if (extract_options.preserve_positions) { hb_buffer_append_whitespace(output, range_length(token->range)); }
      }
    }
  }

  herb_free_tokens(&tokens);
}

void herb_extract_ruby_to_buffer(const char* source, hb_buffer_T* output) {
  herb_extract_ruby_to_buffer_with_options(source, output, NULL);
}

void herb_extract_html_to_buffer(const char* source, hb_buffer_T* output) {
  hb_array_T* tokens = herb_lex(source);

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    const token_T* token = hb_array_get(tokens, i);

    switch (token->type) {
      case TOKEN_ERB_START:
      case TOKEN_ERB_CONTENT:
      case TOKEN_ERB_END: hb_buffer_append_whitespace(output, range_length(token->range)); break;
      default: hb_buffer_append(output, token->value);
    }
  }

  herb_free_tokens(&tokens);
}

char* herb_extract_ruby_with_semicolons(const char* source) {
  if (!source) { return NULL; }

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  herb_extract_ruby_to_buffer(source, &output);

  return output.value;
}

char* herb_extract(const char* source, const herb_extract_language_T language) {
  if (!source) { return NULL; }

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  switch (language) {
    case HERB_EXTRACT_LANGUAGE_RUBY: herb_extract_ruby_to_buffer(source, &output); break;
    case HERB_EXTRACT_LANGUAGE_HTML: herb_extract_html_to_buffer(source, &output); break;
    default: assert(0 && "invalid extract language");
  }

  return output.value;
}

char* herb_extract_from_file(const char* path, const herb_extract_language_T language) {
  char* source = herb_read_file(path);
  char* output = herb_extract(source, language);

  free(source);

  return output;
}

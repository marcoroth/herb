#include "include/herb.h"
#include "include/util/hb_allocator.h"
#include "include/util/hb_array.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"
#include "include/util/string.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

const herb_extract_ruby_options_T HERB_EXTRACT_RUBY_DEFAULT_OPTIONS = { .semicolons = true,
                                                                        .comments = false,
                                                                        .preserve_positions = true };

void herb_extract_ruby_to_buffer_with_options(
  const char* source,
  hb_buffer_T* output,
  const herb_extract_ruby_options_T* options,
  hb_allocator_T* allocator
) {
  herb_extract_ruby_options_T extract_options = options ? *options : HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;

  hb_array_T* tokens = herb_lex(source, allocator);
  bool skip_erb_content = false;
  bool is_comment_tag = false;
  bool is_erb_comment_tag = false;
  bool need_newline = false;

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    const token_T* token = hb_array_get(tokens, i);

    switch (token->type) {
      case TOKEN_NEWLINE: {
        hb_buffer_append_string(output, token->value);
        need_newline = false;
        break;
      }

      case TOKEN_ERB_START: {
        is_erb_comment_tag = hb_string_equals(token->value, hb_string("<%#"));

        if (is_erb_comment_tag) {
          if (extract_options.comments) {
            skip_erb_content = false;
            is_comment_tag = false;

            if (extract_options.preserve_positions) {
              bool is_multiline = false;

              if (i + 1 < hb_array_size(tokens)) {
                const token_T* next = hb_array_get(tokens, i + 1);

                if (next->type == TOKEN_ERB_CONTENT && !hb_string_is_null(next->value)
                    && memchr(next->value.data, '\n', next->value.length) != NULL) {
                  is_multiline = true;
                }
              }

              if (is_multiline) {
                hb_buffer_append_char(output, '#');
                hb_buffer_append_whitespace(output, 2);
              } else {
                hb_buffer_append_whitespace(output, 2);
                hb_buffer_append_char(output, '#');
              }
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
        } else if (hb_string_equals(token->value, hb_string("<%%")) || hb_string_equals(token->value, hb_string("<%%="))
                   || hb_string_equals(token->value, hb_string("<%graphql"))) {
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

          if (!extract_options.comments && !is_comment_tag && !hb_string_is_empty(token->value)) {
            const char* content = token->value.data;

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
          } else if (is_erb_comment_tag && !hb_string_is_null(token->value)) {
            const char* content = token->value.data;
            size_t content_remaining = token->value.length;

            while (content_remaining > 0) {
              if (*content == '\n') {
                hb_buffer_append_char(output, '\n');
                content++;
                content_remaining--;

                if (content_remaining > 0 && extract_options.preserve_positions && *content == ' ') {
                  content++;
                  content_remaining--;
                }

                hb_buffer_append_char(output, '#');
              } else {
                hb_buffer_append_char(output, *content);
                content++;
                content_remaining--;
              }
            }

            if (!extract_options.preserve_positions) { need_newline = true; }
          } else {
            hb_buffer_append_string(output, token->value);

            if (!extract_options.preserve_positions) { need_newline = true; }
          }
        } else {
          if (is_erb_comment_tag && extract_options.preserve_positions && !hb_string_is_null(token->value)) {
            const char* content = token->value.data;
            size_t content_remaining = token->value.length;

            while (content_remaining > 0) {
              if (*content == '\n') {
                hb_buffer_append_char(output, '\n');
              } else {
                hb_buffer_append_char(output, ' ');
              }

              content++;
              content_remaining--;
            }
          } else if (extract_options.preserve_positions) {
            hb_buffer_append_whitespace(output, range_length(token->range));
          }
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

  herb_free_tokens(&tokens, allocator);
}

void herb_extract_ruby_to_buffer(const char* source, hb_buffer_T* output, hb_allocator_T* allocator) {
  herb_extract_ruby_to_buffer_with_options(source, output, NULL, allocator);
}

void herb_extract_html_to_buffer(const char* source, hb_buffer_T* output, hb_allocator_T* allocator) {
  hb_array_T* tokens = herb_lex(source, allocator);

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    const token_T* token = hb_array_get(tokens, i);

    switch (token->type) {
      case TOKEN_ERB_START:
      case TOKEN_ERB_CONTENT:
      case TOKEN_ERB_END: hb_buffer_append_whitespace(output, range_length(token->range)); break;
      default: hb_buffer_append_string(output, token->value);
    }
  }

  herb_free_tokens(&tokens, allocator);
}

char* herb_extract_ruby_with_semicolons(const char* source, hb_allocator_T* allocator) {
  if (!source) { return NULL; }

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  herb_extract_ruby_to_buffer(source, &output, allocator);

  return output.value;
}

char* herb_extract(const char* source, const herb_extract_language_T language, hb_allocator_T* allocator) {
  if (!source) { return NULL; }

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  switch (language) {
    case HERB_EXTRACT_LANGUAGE_RUBY: herb_extract_ruby_to_buffer(source, &output, allocator); break;
    case HERB_EXTRACT_LANGUAGE_HTML: herb_extract_html_to_buffer(source, &output, allocator); break;
    default: assert(0 && "invalid extract language");
  }

  return output.value;
}

#include "include/extract_internal.h"
#include "include/herb.h"
#include "include/lexer/lexer.h"
#include "include/lexer/token.h"
#include "include/lib/hb_allocator.h"
#include "include/lib/hb_array.h"
#include "include/lib/hb_buffer.h"
#include "include/lib/hb_string.h"
#include "include/lib/string.h"
#include "include/util/utf8.h"
#include "include/util/util.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

const herb_extract_ruby_options_T HERB_EXTRACT_RUBY_DEFAULT_OPTIONS = { .semicolons = true,
                                                                        .comments = false,
                                                                        .preserve_positions = true,
                                                                        .custom_tags = false,
                                                                        .erb_openers = NULL,
                                                                        .erb_opener_count = 0 };

typedef struct {
  herb_extract_ruby_options_T options;
  hb_buffer_T* output;
  bool skip_erb_content;
  bool is_comment_tag;
  bool is_erb_comment_tag;
  bool need_newline;
  bool preserve_byte_positions;
  const char* source;
} extract_ruby_state_T;

static void extract_ruby_mask_data(extract_ruby_state_T* state, const char* data, uint32_t length) {
  uint32_t position = 0;

  while (position < length) {
    if (is_newline(data[position])) {
      hb_buffer_append_char(state->output, data[position]);
      state->need_newline = false;
      position++;
      continue;
    }

    uint32_t byte_length = 1;

    if (!state->preserve_byte_positions) {
      byte_length = utf8_sequence_length(hb_string_from_data(data + position, length - position));
    }

    hb_buffer_append_char(state->output, ' ');
    position += byte_length;
  }
}

static void extract_ruby_mask_range(extract_ruby_state_T* state, range_T range) {
  extract_ruby_mask_data(state, state->source + range.from, range_length(range));
}

static void extract_ruby_data(extract_ruby_state_T* state, const char* data, uint32_t from, uint32_t to) {
  if (state->options.preserve_positions) {
    extract_ruby_mask_data(state, data + from, to - from);
    return;
  }

  for (uint32_t position = from; position < to; position++) {
    if (!is_newline(data[position])) { continue; }

    hb_buffer_append_char(state->output, data[position]);
    state->need_newline = false;
  }
}

static void extract_ruby_token(extract_ruby_state_T* state, const token_T* token, const token_T* next) {
  switch (token->type) {
    case TOKEN_NEWLINE: {
      hb_buffer_append_string(state->output, token->value);
      state->need_newline = false;
      break;
    }

    case TOKEN_ERB_START: {
      state->is_erb_comment_tag = hb_string_equals(token->value, hb_string("<%#"));

      if (state->is_erb_comment_tag) {
        if (state->options.comments) {
          state->skip_erb_content = false;
          state->is_comment_tag = false;

          if (state->options.preserve_positions) {
            bool is_multiline = false;

            if (next && next->type == TOKEN_ERB_CONTENT && !hb_string_is_null(next->value)
                && memchr(next->value.data, '\n', next->value.length) != NULL) {
              is_multiline = true;
            }

            if (is_multiline) {
              hb_buffer_append_char(state->output, '#');
              hb_buffer_append_whitespace(state->output, 2);
            } else {
              hb_buffer_append_whitespace(state->output, 2);
              hb_buffer_append_char(state->output, '#');
            }
          } else {
            if (state->need_newline) { hb_buffer_append_char(state->output, '\n'); }
            hb_buffer_append_char(state->output, '#');
            state->need_newline = true;
          }
        } else {
          state->skip_erb_content = true;
          state->is_comment_tag = true;
          if (state->options.preserve_positions) { extract_ruby_mask_range(state, token->range); }
        }
      } else if (hb_string_equals(token->value, hb_string("<%%")) || hb_string_equals(token->value, hb_string("<%%="))
                 || (erb_opening_is_custom(token->value) && !state->options.custom_tags)) {
        state->skip_erb_content = true;
        state->is_comment_tag = false;
        if (state->options.preserve_positions) { extract_ruby_mask_range(state, token->range); }
      } else {
        state->skip_erb_content = false;
        state->is_comment_tag = false;

        if (state->options.preserve_positions) {
          extract_ruby_mask_range(state, token->range);
        } else if (state->need_newline) {
          hb_buffer_append_char(state->output, '\n');
          state->need_newline = false;
        }
      }

      break;
    }

    case TOKEN_ERB_CONTENT: {
      if (state->skip_erb_content == false) {
        bool is_inline_comment = false;

        if (!state->options.comments && !state->is_comment_tag && !hb_string_is_empty(token->value)) {
          hb_string_T trimmed = hb_string_trim_start(token->value);

          if (!hb_string_is_empty(trimmed) && trimmed.data[0] == '#'
              && token->location.start.line == token->location.end.line) {
            state->is_comment_tag = true;
            is_inline_comment = true;
          }
        }

        if (is_inline_comment) {
          if (state->options.preserve_positions) { extract_ruby_mask_range(state, token->range); }
        } else if (state->is_erb_comment_tag && !hb_string_is_null(token->value)) {
          const char* content = token->value.data;
          size_t content_remaining = token->value.length;

          while (content_remaining > 0) {
            if (*content == '\n') {
              hb_buffer_append_char(state->output, '\n');
              content++;
              content_remaining--;

              if (content_remaining > 0 && state->options.preserve_positions && *content == ' ') {
                content++;
                content_remaining--;
              }

              hb_buffer_append_char(state->output, '#');
            } else {
              hb_buffer_append_char(state->output, *content);
              content++;
              content_remaining--;
            }
          }

          if (!state->options.preserve_positions) { state->need_newline = true; }
        } else {
          hb_buffer_append_string(state->output, token->value);

          if (!state->options.preserve_positions) { state->need_newline = true; }
        }
      } else {
        if (state->is_erb_comment_tag && state->options.preserve_positions && !hb_string_is_null(token->value)) {
          extract_ruby_mask_range(state, token->range);
        } else if (state->options.preserve_positions) {
          extract_ruby_mask_range(state, token->range);
        }
      }

      break;
    }

    case TOKEN_ERB_END: {
      bool was_comment = state->is_comment_tag;
      bool was_erb_comment = state->is_erb_comment_tag;
      state->skip_erb_content = false;
      state->is_comment_tag = false;
      state->is_erb_comment_tag = false;

      if (state->options.preserve_positions) {
        if (was_comment) {
          extract_ruby_mask_range(state, token->range);
        } else if (was_erb_comment && state->options.comments) {
          extract_ruby_mask_range(state, token->range);
        } else if (state->options.semicolons) {
          size_t length = range_length(token->range);

          if (length >= 2) { hb_buffer_append_char(state->output, ' '); }
          if (length >= 1) { hb_buffer_append_char(state->output, ';'); }
          if (length >= 2) { hb_buffer_append_whitespace(state->output, length - 2); }
        } else {
          extract_ruby_mask_range(state, token->range);
        }
      }

      break;
    }

    default: {
      if (state->options.preserve_positions) { extract_ruby_mask_range(state, token->range); }
    }
  }
}

static void herb_extract_ruby_to_buffer_internal(
  const char* source,
  hb_buffer_T* output,
  const herb_extract_ruby_options_T* options,
  bool preserve_byte_positions,
  hb_allocator_T* allocator
) {
  extract_ruby_state_T state = {
    .options = options ? *options : HERB_EXTRACT_RUBY_DEFAULT_OPTIONS,
    .output = output,
    .skip_erb_content = false,
    .is_comment_tag = false,
    .is_erb_comment_tag = false,
    .need_newline = false,
    .preserve_byte_positions = preserve_byte_positions,
    .source = NULL,
  };

  parser_options_T lex_options = HERB_DEFAULT_PARSER_OPTIONS;
  lex_options.erb_openers = state.options.erb_openers;
  lex_options.erb_opener_count = state.options.erb_opener_count;

  lexer_T lexer = { 0 };
  lexer_init(&lexer, source ? source : "", allocator);
  lexer_apply_erb_openers(&lexer, &lex_options);

  const char* data = lexer.source.data;
  uint32_t length = (uint32_t) lexer.source.length;
  token_T* pending = NULL;
  state.source = data;

  while (true) {
    if (!pending && lexer.state == STATE_DATA) {
      uint32_t position = lexer.current_position;

      while (position < length && !(data[position] == '<' && data[position + 1] == '%')) {
        position++;
      }

      extract_ruby_data(&state, data, lexer.current_position, position);
      lexer_skip_data_to(&lexer, position);
    }

    token_T* token = pending ? pending : lexer_next_token(&lexer);
    pending = NULL;

    if (token->type == TOKEN_EOF) {
      token_free(token, allocator);
      break;
    }

    if (token->type == TOKEN_ERB_START) { pending = lexer_next_token(&lexer); }

    extract_ruby_token(&state, token, pending);
    token_free(token, allocator);
  }
}

void herb_extract_ruby_to_buffer_with_options(
  const char* source,
  hb_buffer_T* output,
  const herb_extract_ruby_options_T* options,
  hb_allocator_T* allocator
) {
  herb_extract_ruby_to_buffer_internal(source, output, options, false, allocator);
}

void herb_extract_ruby_to_buffer_with_options_preserving_bytes(
  const char* source,
  hb_buffer_T* output,
  const herb_extract_ruby_options_T* options,
  hb_allocator_T* allocator
) {
  herb_extract_ruby_to_buffer_internal(source, output, options, true, allocator);
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

char* herb_extract_ruby_with_semicolons_and_openers(
  const char* source,
  const hb_string_T* erb_openers,
  size_t erb_opener_count,
  hb_allocator_T* allocator
) {
  if (!source) { return NULL; }

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source), allocator);

  herb_extract_ruby_options_T extract_options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;
  extract_options.erb_openers = erb_openers;
  extract_options.erb_opener_count = erb_opener_count;

  herb_extract_ruby_to_buffer_with_options(source, &output, &extract_options, allocator);

  return output.value;
}

char* herb_extract_ruby_with_semicolons(const char* source, hb_allocator_T* allocator) {
  return herb_extract_ruby_with_semicolons_and_openers(source, NULL, 0, allocator);
}

char* herb_extract(const char* source, const herb_extract_language_T language, hb_allocator_T* allocator) {
  if (!source) { return NULL; }

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source), allocator);

  switch (language) {
    case HERB_EXTRACT_LANGUAGE_RUBY: herb_extract_ruby_to_buffer(source, &output, allocator); break;
    case HERB_EXTRACT_LANGUAGE_HTML: herb_extract_html_to_buffer(source, &output, allocator); break;
    default: assert(0 && "invalid extract language");
  }

  return output.value;
}

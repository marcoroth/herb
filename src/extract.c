#include "include/herb.h"
#include "include/lexer/lexer.h"
#include "include/lexer/token.h"
#include "include/lib/hb_allocator.h"
#include "include/lib/hb_array.h"
#include "include/lib/hb_buffer.h"
#include "include/lib/hb_string.h"
#include "include/lib/string.h"
#include "include/util/util.h"

#include <assert.h>
#include <ctype.h>
#include <stdlib.h>
#include <string.h>

const herb_extract_ruby_options_T HERB_EXTRACT_RUBY_DEFAULT_OPTIONS = { .semicolons = true,
                                                                        .comments = false,
                                                                        .preserve_positions = true,
                                                                        .custom_tags = false,
                                                                        .erb_openers = NULL,
                                                                        .erb_opener_count = 0 };

static bool skip_ruby_tag(hb_string_T opening, const herb_extract_ruby_options_T* options) {
  return hb_string_equals(opening, hb_string("<%%")) || hb_string_equals(opening, hb_string("<%%="))
      || (erb_opening_is_custom(opening) && !options->custom_tags);
}

// Used to decide if a comment is safe to preserve.
static bool ruby_content_follows_on_line(const lexer_T* lexer, const herb_extract_ruby_options_T* options) {
  lexer_T lookahead = *lexer;
  bool skip_content = false;
  bool erb_comment = false;

  while (true) {
    if (lookahead.state == STATE_DATA) {
      uint32_t position = lookahead.current_position;
      const char* data = lookahead.source.data;

      while (position < lookahead.source.length && !(data[position] == '<' && data[position + 1] == '%')) {
        if (is_newline(data[position])) { return false; }
        position++;
      }

      lexer_skip_data_to(&lookahead, position);
    }

    token_T* token = lexer_next_token(&lookahead);
    bool finished = false;
    bool follows = false;

    switch (token->type) {
      case TOKEN_EOF:
      case TOKEN_NEWLINE: finished = true; break;
      case TOKEN_ERB_START:
        erb_comment = hb_string_equals(token->value, hb_string("<%#"));
        skip_content = erb_comment || skip_ruby_tag(token->value, options);
        break;
      case TOKEN_ERB_CONTENT: {
        // Only skipped ERB comments preserve newlines in their content.
        if (erb_comment && hb_string_contains_character(token->value, '\n')) { finished = true; }
        if (skip_content || hb_string_is_empty(token->value)) { break; }

        for (size_t offset = 0; offset < token->value.length; offset++) {
          unsigned char character = (unsigned char) token->value.data[offset];

          if (character == '\n') {
            finished = true;
            break;
          }

          if (!isspace(character)) {
            finished = true;
            follows = true;
            break;
          }
        }

        break;
      }
      default: break;
    }

    token_free(token, lookahead.allocator);
    if (finished) { return follows; }
  }
}

typedef struct {
  herb_extract_ruby_options_T options;
  hb_buffer_T* output;
  bool skip_erb_content;
  bool is_comment_tag;
  bool is_erb_comment_tag;
  bool need_newline;
} extract_ruby_state_T;

static void extract_ruby_data(extract_ruby_state_T* state, const char* data, uint32_t from, uint32_t to) {
  uint32_t run_start = from;

  for (uint32_t position = from; position < to; position++) {
    if (!is_newline(data[position])) { continue; }

    if (state->options.preserve_positions) { hb_buffer_append_whitespace(state->output, position - run_start); }

    hb_buffer_append_char(state->output, data[position]);
    state->need_newline = false;
    run_start = position + 1;
  }

  if (state->options.preserve_positions) { hb_buffer_append_whitespace(state->output, to - run_start); }
}

static void extract_ruby_token(
  extract_ruby_state_T* state,
  const token_T* token,
  const token_T* next,
  const lexer_T* lexer
) {
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
          if (state->options.preserve_positions) {
            hb_buffer_append_whitespace(state->output, range_length(token->range));
          }
        }
      } else if (skip_ruby_tag(token->value, &state->options)) {
        state->skip_erb_content = true;
        state->is_comment_tag = false;
        if (state->options.preserve_positions) {
          hb_buffer_append_whitespace(state->output, range_length(token->range));
        }
      } else {
        state->skip_erb_content = false;
        state->is_comment_tag = false;

        if (state->options.preserve_positions) {
          hb_buffer_append_whitespace(state->output, range_length(token->range));
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

        if (!state->options.comments && state->options.preserve_positions && !state->is_comment_tag
            && !hb_string_is_empty(token->value)) {
          hb_string_T trimmed = hb_string_trim_start(token->value);

          if (!hb_string_is_empty(trimmed) && trimmed.data[0] == '#'
              && token->location.start.line == token->location.end.line
              && ruby_content_follows_on_line(lexer, &state->options)) {
            state->is_comment_tag = true;
            is_inline_comment = true;
          }
        }

        if (is_inline_comment) {
          hb_buffer_append_whitespace(state->output, range_length(token->range));
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
          const char* content = token->value.data;
          size_t content_remaining = token->value.length;

          while (content_remaining > 0) {
            if (*content == '\n') {
              hb_buffer_append_char(state->output, '\n');
            } else {
              hb_buffer_append_char(state->output, ' ');
            }

            content++;
            content_remaining--;
          }
        } else if (state->options.preserve_positions) {
          hb_buffer_append_whitespace(state->output, range_length(token->range));
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
          hb_buffer_append_whitespace(state->output, range_length(token->range));
        } else if (was_erb_comment && state->options.comments) {
          hb_buffer_append_whitespace(state->output, range_length(token->range));
        } else if (state->options.semicolons) {
          size_t length = range_length(token->range);

          if (length >= 2) { hb_buffer_append_char(state->output, ' '); }
          if (length >= 1) { hb_buffer_append_char(state->output, ';'); }
          if (length >= 2) { hb_buffer_append_whitespace(state->output, length - 2); }
        } else {
          hb_buffer_append_whitespace(state->output, range_length(token->range));
        }
      }

      break;
    }

    default: {
      if (state->options.preserve_positions) { hb_buffer_append_whitespace(state->output, range_length(token->range)); }
    }
  }
}

void herb_extract_ruby_to_buffer_with_options(
  const char* source,
  hb_buffer_T* output,
  const herb_extract_ruby_options_T* options,
  hb_allocator_T* allocator
) {
  extract_ruby_state_T state = {
    .options = options ? *options : HERB_EXTRACT_RUBY_DEFAULT_OPTIONS,
    .output = output,
    .skip_erb_content = false,
    .is_comment_tag = false,
    .is_erb_comment_tag = false,
    .need_newline = false,
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

    extract_ruby_token(&state, token, pending, &lexer);
    token_free(token, allocator);
  }
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

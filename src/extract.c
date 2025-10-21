#include "include/herb.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/util/hb_array.h"
#include "include/util/hb_buffer.h"

#include <stdlib.h>
#include <string.h>

void herb_extract_ruby_to_buffer_with_semicolons(const char* source, hb_buffer_T* output) {
  hb_array_T* tokens = herb_lex(source);
  bool skip_erb_content = false;

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    const token_T* token = hb_array_get(tokens, i);

    switch (token->type) {
      case TOKEN_NEWLINE: {
        hb_buffer_append(output, token->value);
        break;
      }

      case TOKEN_ERB_START: {
        if (strcmp(token->value, "<%#") == 0 || strcmp(token->value, "<%%") == 0 || strcmp(token->value, "<%%=") == 0) {
          skip_erb_content = true;
        }

        hb_buffer_append_whitespace(output, range_length(token->range));
        break;
      }

      case TOKEN_ERB_CONTENT: {
        if (skip_erb_content == false) {
          hb_buffer_append(output, token->value);
        } else {
          hb_buffer_append_whitespace(output, range_length(token->range));
        }

        break;
      }

      case TOKEN_ERB_END: {
        skip_erb_content = false;

        hb_buffer_append_char(output, ' ');
        hb_buffer_append_char(output, ';');
        hb_buffer_append_whitespace(output, range_length(token->range) - 2);
        break;
      }

      default: {
        hb_buffer_append_whitespace(output, range_length(token->range));
      }
    }
  }

  herb_free_tokens(&tokens);
}

void herb_extract_ruby_to_buffer(const char* source, hb_buffer_T* output) {
  hb_array_T* tokens = herb_lex(source);
  bool skip_erb_content = false;

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    const token_T* token = hb_array_get(tokens, i);

    switch (token->type) {
      case TOKEN_NEWLINE: {
        hb_buffer_append(output, token->value);
        break;
      }

      case TOKEN_ERB_START: {
        if (strcmp(token->value, "<%#") == 0 || strcmp(token->value, "<%%") == 0 || strcmp(token->value, "<%%=") == 0) {
          skip_erb_content = true;
        }

        hb_buffer_append_whitespace(output, range_length(token->range));
        break;
      }

      case TOKEN_ERB_CONTENT: {
        if (skip_erb_content == false) {
          hb_buffer_append(output, token->value);
        } else {
          hb_buffer_append_whitespace(output, range_length(token->range));
        }

        break;
      }

      case TOKEN_ERB_END: {
        skip_erb_content = false;

        hb_buffer_append_whitespace(output, range_length(token->range));
        break;
      }

      default: {
        hb_buffer_append_whitespace(output, range_length(token->range));
      }
    }
  }

  herb_free_tokens(&tokens);
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

  herb_extract_ruby_to_buffer_with_semicolons(source, &output);

  return output.value;
}

char* herb_extract(const char* source, const herb_extract_language_T language) {
  if (!source) { return NULL; }

  hb_buffer_T output;
  hb_buffer_init(&output, strlen(source));

  switch (language) {
    case HERB_EXTRACT_LANGUAGE_RUBY: herb_extract_ruby_to_buffer(source, &output); break;
    case HERB_EXTRACT_LANGUAGE_HTML: herb_extract_html_to_buffer(source, &output); break;
  }

  return output.value;
}

char* herb_extract_from_file(const char* path, const herb_extract_language_T language) {
  char* source = herb_read_file(path);
  char* output = herb_extract(source, language);

  free(source);

  return output;
}

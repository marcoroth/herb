#include "include/array.h"
#include "include/buffer.h"
#include "include/erbx.h"
#include "include/io.h"
#include "include/lexer.h"
#include "include/parser.h"
#include "include/token.h"
#include "include/version.h"

#include <stdlib.h>

void erbx_extract_ruby_to_buffer(char* source, buffer_T* output) {
  array_T* tokens = erbx_lex(source);

  for (int i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);

    switch (token->type) {
      case TOKEN_NEWLINE:
      case TOKEN_ERB_CONTENT: {
        buffer_append(output, token->value);
      } break;

      default: {
        range_T* range = token->range;
        size_t length = range->end - range->start;

        for (int i = 0; i < length; i++) {
          buffer_append(output, " ");
        }
      } break;
    }
  }
}

void erbx_extract_html_to_buffer(char* source, buffer_T* output) {
  array_T* tokens = erbx_lex(source);

  for (int i = 0; i < array_size(tokens); i++) {
    token_T* token = array_get(tokens, i);

    switch (token->type) {
      case TOKEN_ERB_START:
      case TOKEN_ERB_CONTENT:
      case TOKEN_ERB_END: {
        range_T* range = token->range;
        size_t length = range->end - range->start;

        for (int i = 0; i < length; i++) {
          buffer_append(output, " ");
        }
      } break;

      default: buffer_append(output, token->value);
    }
  }
}

char* erbx_extract(char* source, erbx_extract_language_T language) {
  buffer_T output;
  buffer_init(&output);

  switch (language) {
    case ERBX_EXTRACT_LANGUAGE_RUBY: erbx_extract_ruby_to_buffer(source, &output); break;
    case ERBX_EXTRACT_LANGUAGE_HTML: erbx_extract_html_to_buffer(source, &output); break;
  }

  char* value = output.value;

  buffer_free(&output);

  return value;
}

char* erbx_extract_from_file(const char* path, erbx_extract_language_T language) {
  char* source = erbx_read_file(path);
  char* output = erbx_extract(source, language);

  free(source);

  return output;
}

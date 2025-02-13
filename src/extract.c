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
      case TOKEN_ERB_CONTENT: buffer_append(output, token->value); break;
      case TOKEN_NEWLINE: buffer_append(output, token->value); break;
      default: buffer_append_whitespace(output, range_length(token->range));
    }
  }
}

char* erbx_extract_ruby(char* source) {
  buffer_T output;

  buffer_init(&output);

  erbx_extract_ruby_to_buffer(source, &output);
  char* value = output.value;

  buffer_free(&output);

  return value;
}

char* erbx_extract_ruby_from_file(const char* path) {
  char* source = erbx_read_file(path);
  char* output = erbx_extract_ruby(source);

  free(source);

  return output;
}

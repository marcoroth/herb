#include "include/array.h"
#include "include/buffer.h"
#include "include/herb.h"
#include "include/io.h"
#include "include/lexer.h"

#include <stdlib.h>

void herb_extract_ruby_to_buffer(const char* source, buffer_T* output) {
  const array_T* tokens = herb_lex(source);

  for (size_t i = 0; i < array_size(tokens); i++) {
    const token_T* token = array_get(tokens, i);

    switch (token->type) {
      case TOKEN_NEWLINE:
      case TOKEN_ERB_CONTENT: buffer_append(output, token->value); break;
      default: buffer_append_whitespace(output, range_length(token->range));
    }
  }
}

void herb_extract_html_to_buffer(const char* source, buffer_T* output) {
  const array_T* tokens = herb_lex(source);

  for (size_t i = 0; i < array_size(tokens); i++) {
    const token_T* token = array_get(tokens, i);

    switch (token->type) {
      case TOKEN_ERB_START:
      case TOKEN_ERB_CONTENT:
      case TOKEN_ERB_END: buffer_append_whitespace(output, range_length(token->range)); break;
      default: buffer_append(output, token->value);
    }
  }
}

char* herb_extract(const char* source, const herb_extract_language_T language) {
  buffer_T output;
  buffer_init(&output);

  switch (language) {
    case HERB_EXTRACT_LANGUAGE_RUBY: herb_extract_ruby_to_buffer(source, &output); break;
    case HERB_EXTRACT_LANGUAGE_HTML: herb_extract_html_to_buffer(source, &output); break;
  }

  char* value = output.value;

  return value;
}

char* herb_extract_from_file(const char* path, const herb_extract_language_T language) {
  char* source = herb_read_file(path);
  char* output = herb_extract(source, language);

  free(source);

  return output;
}

#include "include/array.h"
#include "include/ast_node.h"
#include "include/ast_nodes.h"
#include "include/pretty_print.h"
#include "include/ast_pretty_print.h"
#include "include/buffer.h"
#include "include/herb.h"
#include "include/token.h"

#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

EM_JS(void, js_create_object, (const char* json), {
  var object = JSON.parse(UTF8ToString(json));

  return object;
});

EMSCRIPTEN_KEEPALIVE char* wasm_lex(const char* source) {
  buffer_T output;
  buffer_init(&output);

  herb_lex_to_buffer(source, &output);

  return buffer_value(&output);
}

EMSCRIPTEN_KEEPALIVE char* wasm_parse(const char* source) {
  buffer_T output;
  buffer_init(&output);

  AST_DOCUMENT_NODE_T* root = herb_parse(source);

  ast_pretty_print_node((AST_NODE_T*) root, 0, 0, &output);

  return buffer_value(&output);
}

EMSCRIPTEN_KEEPALIVE char* wasm_extract_ruby(const char* source) {
  buffer_T output;
  buffer_init(&output);

  herb_extract_ruby_to_buffer(source, &output);

  char* result = output.value;

  return result;
}

EMSCRIPTEN_KEEPALIVE char* wasm_extract_html(const char* source) {
  buffer_T output;
  buffer_init(&output);

  herb_extract_html_to_buffer(source, &output);

  char* result = output.value;

  return result;
}

EMSCRIPTEN_KEEPALIVE char* wasm_version() {
  const char* native_version = herb_version();
  char* version_buf = malloc(256);

  snprintf(version_buf, 256, "libherb@%s (WebAssembly)", native_version);

  return version_buf;
}

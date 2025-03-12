#ifndef EXTENSION_HELPERS_H
#define EXTENSION_HELPERS_H

#include <emscripten/val.h>
#include <string>

extern "C" {
#include "../src/include/position.h"
#include "../src/include/location.h"
#include "../src/include/range.h"
#include "../src/include/token.h"
#include "../src/include/ast_node.h"
#include "../src/include/ast_nodes.h"
}

emscripten::val CreateString(const char* string);
emscripten::val CreatePosition(position_T* position);
emscripten::val CreateLocation(location_T* location);
emscripten::val CreateRange(range_T* range);
emscripten::val CreateToken(token_T* token);
emscripten::val CreateLexResult(array_T* tokens, const std::string& source);
emscripten::val CreateParseResult(AST_DOCUMENT_NODE_T *root, const std::string& source);

#endif

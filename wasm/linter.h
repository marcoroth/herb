#ifndef HERB_LINTER_WASM_H
#define HERB_LINTER_WASM_H

#ifdef HAS_HERB_LINTER

#include <emscripten/val.h>
#include <string>

emscripten::val Herb_lint(const std::string& source, emscripten::val config, emscripten::val fileName);
size_t Herb_lint_rule_count();
emscripten::val Herb_lint_rule_names();

#endif

#endif

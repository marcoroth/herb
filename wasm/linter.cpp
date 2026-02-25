#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <string>
#include <cstdlib>

extern "C" {
#include "herb_linter.h"
}

#include "linter.h"

using namespace emscripten;

val Herb_lint(const std::string& source, val config, val fileName) {
  const char* config_c_string = nullptr;
  std::string config_string;

  if (!config.isUndefined() && !config.isNull() && config.typeOf().as<std::string>() == "string") {
    config_string = config.as<std::string>();
    config_c_string = config_string.c_str();
  }

  const char* file_name_c_string = nullptr;
  std::string file_name_string;

  if (!fileName.isUndefined() && !fileName.isNull() && fileName.typeOf().as<std::string>() == "string") {
    file_name_string = fileName.as<std::string>();
    file_name_c_string = file_name_string.c_str();
  }

  herb_lint_result_T* result = herb_lint(source.c_str(), config_c_string, file_name_c_string);

  if (result == nullptr) {
    return val::null();
  }

  val JSON = val::global("JSON");
  val parsed = JSON.call<val>("parse", std::string(result->json));

  herb_lint_result_free(result);

  return parsed;
}

size_t Herb_lint_rule_count() {
  return herb_lint_rule_count();
}

val Herb_lint_rule_names() {
  size_t count = 0;
  char** names = herb_lint_rule_names(&count);

  val array = val::array();

  for (size_t index = 0; index < count; index++) {
    array.call<void>("push", std::string(names[index]));
  }

  herb_lint_rule_names_free(names, count);

  return array;
}

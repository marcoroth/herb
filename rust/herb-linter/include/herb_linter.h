#ifndef HERB_LINTER_H
#define HERB_LINTER_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
  char* json;
  size_t offense_count;
  size_t error_count;
  size_t warning_count;
  size_t info_count;
  size_t hint_count;
} herb_lint_result_T;

herb_lint_result_T* herb_lint(const char* source, const char* config_json, const char* file_name);
void herb_lint_result_free(herb_lint_result_T* result);

size_t herb_lint_rule_count(void);
char** herb_lint_rule_names(size_t* count);
void herb_lint_rule_names_free(char** names, size_t count);

#ifdef __cplusplus
}
#endif

#endif

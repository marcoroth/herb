#ifndef HERB_LINTER_NODE_H
#define HERB_LINTER_NODE_H

#include <node_api.h>

napi_value Herb_lint(napi_env env, napi_callback_info info);
napi_value Herb_lint_rule_count(napi_env env, napi_callback_info info);
napi_value Herb_lint_rule_names(napi_env env, napi_callback_info info);

#endif

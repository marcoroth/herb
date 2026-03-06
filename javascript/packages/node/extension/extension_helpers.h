#ifndef HERB_NODE_EXTENSION_HELPERS_H
#define HERB_NODE_EXTENSION_HELPERS_H

#include <node_api.h>

extern "C" {
#include "../extension/libherb/include/ast_nodes.h"
#include "../extension/libherb/include/herb.h"
#include "../extension/libherb/include/util/hb_array.h"
#include "../extension/libherb/include/util/hb_string.h"
}

char* CheckString(napi_env env, napi_value value);
napi_value CreateString(napi_env env, const char* str);
napi_value CreateStringFromHbString(napi_env env, hb_string_T string);
napi_value ReadFileToString(napi_env env, const char* file_path);
napi_value CreateLexResult(napi_env env, hb_array_T* tokens, napi_value source);
napi_value CreateParseResult(napi_env env, AST_DOCUMENT_NODE_T* root, napi_value source, parser_options_T* options);

napi_value CreateLocation(napi_env env, location_T location);
napi_value CreateToken(napi_env env, token_T* token);
napi_value CreatePosition(napi_env env, position_T position);
napi_value CreateRange(napi_env env, range_T range);

#endif

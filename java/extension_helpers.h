#ifndef HERB_JNI_EXTENSION_HELPERS_H
#define HERB_JNI_EXTENSION_HELPERS_H

#include <jni.h>

#include "../../src/include/ast/ast_nodes.h"
#include "../../src/include/location/location.h"
#include "../../src/include/location/position.h"
#include "../../src/include/location/range.h"
#include "../../src/include/lexer/token.h"
#include "../../src/include/lib/hb_array.h"
#include "../../src/include/lib/hb_string.h"

#ifdef __cplusplus
extern "C" {
#endif

jstring CreateStringFromHbString(JNIEnv* env, hb_string_T string);
jobject CreatePosition(JNIEnv* env, position_T position);
jobject CreateLocation(JNIEnv* env, location_T location);
jobject CreateRange(JNIEnv* env, range_T range);
jobject CreateToken(JNIEnv* env, token_T* token);
jobject CreateLexResult(JNIEnv* env, hb_array_T* tokens, jstring source);
jobject CreateParseResult(JNIEnv* env, AST_DOCUMENT_NODE_T* root, jstring source);

#ifdef __cplusplus
}
#endif

#endif

#ifndef HERB_JNI_EXTENSION_HELPERS_H
#define HERB_JNI_EXTENSION_HELPERS_H

#include <jni.h>

#include "../../src/include/ast_nodes.h"
#include "../../src/include/location.h"
#include "../../src/include/position.h"
#include "../../src/include/range.h"
#include "../../src/include/token.h"
#include "../../src/include/util/hb_array.h"

#ifdef __cplusplus
extern "C" {
#endif

jobject CreatePosition(JNIEnv* env, position_T position);
jobject CreateLocation(JNIEnv* env, location_T location);
jobject CreateRange(JNIEnv* env, range_T range);
jobject CreateToken(JNIEnv* env, token_T* token);
jobject CreateLexResult(JNIEnv* env, hb_array_T* tokens, jstring source);
jobject CreateParseResult(JNIEnv* env, AST_DOCUMENT_NODE_T* root, jstring source);
jstring ReadFileToString(JNIEnv* env, const char* path);

#ifdef __cplusplus
}
#endif

#endif

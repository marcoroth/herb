#include "extension_helpers.h"
#include "error_helpers.h"
#include "nodes.h"

#include "../../src/include/ast_nodes.h"
#include "../../src/include/herb.h"
#include "../../src/include/io.h"
#include "../../src/include/location.h"
#include "../../src/include/position.h"
#include "../../src/include/range.h"
#include "../../src/include/token.h"
#include "../../src/include/util/hb_array.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

jobject CreatePosition(JNIEnv* env, position_T position) {
  jclass positionClass = (*env)->FindClass(env, "org/herb/Position");
  jmethodID constructor = (*env)->GetMethodID(env, positionClass, "<init>", "(II)V");

  return (*env)->NewObject(env, positionClass, constructor, (jint) position.line, (jint) position.column);
}

jobject CreateLocation(JNIEnv* env, location_T location) {
  jclass locationClass = (*env)->FindClass(env, "org/herb/Location");
  jmethodID constructor =
      (*env)->GetMethodID(env, locationClass, "<init>", "(Lorg/herb/Position;Lorg/herb/Position;)V");

  jobject start = CreatePosition(env, location.start);
  jobject end = CreatePosition(env, location.end);

  return (*env)->NewObject(env, locationClass, constructor, start, end);
}

jobject CreateRange(JNIEnv* env, range_T range) {
  jclass rangeClass = (*env)->FindClass(env, "org/herb/Range");
  jmethodID constructor = (*env)->GetMethodID(env, rangeClass, "<init>", "(II)V");

  return (*env)->NewObject(env, rangeClass, constructor, (jint) range.from, (jint) range.to);
}

jobject CreateToken(JNIEnv* env, token_T* token) {
  if (!token) { return NULL; }

  jclass tokenClass = (*env)->FindClass(env, "org/herb/Token");
  jmethodID constructor = (*env)->GetMethodID(
      env, tokenClass, "<init>", "(Ljava/lang/String;Ljava/lang/String;Lorg/herb/Location;Lorg/herb/Range;)V");

  jstring type = (*env)->NewStringUTF(env, token_type_to_string(token->type));
  jstring value = (*env)->NewStringUTF(env, token->value);
  jobject location = CreateLocation(env, token->location);
  jobject range = CreateRange(env, token->range);

  return (*env)->NewObject(env, tokenClass, constructor, type, value, location, range);
}

jobject CreateLexResult(JNIEnv* env, hb_array_T* tokens, jstring source) {
  jclass arrayListClass = (*env)->FindClass(env, "java/util/ArrayList");
  jmethodID arrayListConstructor = (*env)->GetMethodID(env, arrayListClass, "<init>", "(I)V");
  jmethodID addMethod = (*env)->GetMethodID(env, arrayListClass, "add", "(Ljava/lang/Object;)Z");

  jobject tokensList = (*env)->NewObject(env, arrayListClass, arrayListConstructor, (jint) tokens->size);

  for (size_t i = 0; i < tokens->size; i++) {
    token_T* token = (token_T*) hb_array_get(tokens, i);
    jobject tokenObj = CreateToken(env, token);
    (*env)->CallBooleanMethod(env, tokensList, addMethod, tokenObj);
  }

  jclass lexResultClass = (*env)->FindClass(env, "org/herb/LexResult");
  jmethodID constructor =
      (*env)->GetMethodID(env, lexResultClass, "<init>", "(Ljava/util/List;Ljava/lang/String;)V");

  return (*env)->NewObject(env, lexResultClass, constructor, tokensList, source);
}

jobject CreateParseResult(JNIEnv* env, AST_DOCUMENT_NODE_T* root, jstring source) {
  jobject value = CreateDocumentNode(env, root);

  jclass arrayListClass = (*env)->FindClass(env, "java/util/ArrayList");
  jmethodID arrayListConstructor = (*env)->GetMethodID(env, arrayListClass, "<init>", "()V");
  jmethodID addMethod = (*env)->GetMethodID(env, arrayListClass, "add", "(Ljava/lang/Object;)Z");

  jobject errorsList = (*env)->NewObject(env, arrayListClass, arrayListConstructor);

  if (root->base.errors) {
    for (size_t i = 0; i < root->base.errors->size; i++) {
      AST_NODE_T* error_node = (AST_NODE_T*) hb_array_get(root->base.errors, i);
      jobject errorObj = CreateErrorNode(env, error_node);
      (*env)->CallBooleanMethod(env, errorsList, addMethod, errorObj);
    }
  }

  jclass parseResultClass = (*env)->FindClass(env, "org/herb/ParseResult");
  jmethodID constructor = (*env)->GetMethodID(
      env, parseResultClass, "<init>", "(Lorg/herb/ast/Node;Ljava/util/List;Ljava/lang/String;)V");

  return (*env)->NewObject(env, parseResultClass, constructor, value, errorsList, source);
}

jstring ReadFileToString(JNIEnv* env, const char* path) {
  char* content = herb_read_file(path);
  if (!content) { return NULL; }

  jstring result = (*env)->NewStringUTF(env, content);
  free(content);

  return result;
}

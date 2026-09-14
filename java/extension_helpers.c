#include "extension_helpers.h"
#include "error_helpers.h"
#include "nodes.h"

#include "../../src/include/ast/ast_nodes.h"
#include "../../src/include/herb.h"
#include "../../src/include/location/location.h"
#include "../../src/include/location/position.h"
#include "../../src/include/location/range.h"
#include "../../src/include/lexer/token.h"
#include "../../src/include/lib/hb_array.h"
#include "../../src/include/lib/hb_string.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

jstring CreateStringFromHbString(JNIEnv* env, hb_string_T string) {
  if (hb_string_is_null(string)) { return NULL; }

  char* c_string = hb_string_to_c_string_using_malloc(string);
  if (!c_string) { return NULL; }

  jstring result = (*env)->NewStringUTF(env, c_string);
  free(c_string);

  return result;
}

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

jobject CreateToken(JNIEnv* env, token_T* token, const parser_options_T* options) {
  if (!token) { return NULL; }

  jclass tokenClass = (*env)->FindClass(env, "org/herb/Token");
  jmethodID constructor = (*env)->GetMethodID(
      env, tokenClass, "<init>", "(Ljava/lang/String;Ljava/lang/String;Lorg/herb/Location;Lorg/herb/Range;)V");

  jstring type = CreateStringFromHbString(env, token_type_to_string(token->type));
  jstring value = CreateStringFromHbString(env, token->value);
  jobject location = options->track_locations ? CreateLocation(env, token->location) : NULL;
  jobject range = options->track_locations ? CreateRange(env, token->range) : NULL;

  return (*env)->NewObject(env, tokenClass, constructor, type, value, location, range);
}

jobject CreateLexResult(JNIEnv* env, hb_array_T* tokens, jstring source) {
  jclass arrayListClass = (*env)->FindClass(env, "java/util/ArrayList");
  jmethodID arrayListConstructor = (*env)->GetMethodID(env, arrayListClass, "<init>", "(I)V");
  jmethodID addMethod = (*env)->GetMethodID(env, arrayListClass, "add", "(Ljava/lang/Object;)Z");

  jobject tokensList = (*env)->NewObject(env, arrayListClass, arrayListConstructor, (jint) hb_array_size(tokens));

  for (size_t i = 0; i < hb_array_size(tokens); i++) {
    token_T* token = (token_T*) hb_array_get(tokens, i);
    jobject tokenObject = CreateToken(env, token, &HERB_DEFAULT_PARSER_OPTIONS);
    (*env)->CallBooleanMethod(env, tokensList, addMethod, tokenObject);
  }

  jclass lexResultClass = (*env)->FindClass(env, "org/herb/LexResult");
  jmethodID constructor =
      (*env)->GetMethodID(env, lexResultClass, "<init>", "(Ljava/util/List;Ljava/lang/String;)V");

  return (*env)->NewObject(env, lexResultClass, constructor, tokensList, source);
}

jobject CreateParseResult(JNIEnv* env, AST_DOCUMENT_NODE_T* root, jstring source, const parser_options_T* options) {
  jobject value = CreateDocumentNode(env, root, options);

  jclass arrayListClass = (*env)->FindClass(env, "java/util/ArrayList");
  jmethodID arrayListConstructor = (*env)->GetMethodID(env, arrayListClass, "<init>", "()V");

  jobject errorsList = (*env)->NewObject(env, arrayListClass, arrayListConstructor);

  jobject errorCount = NULL;

  if (options->error_count != NULL) {
    jclass integerClass = (*env)->FindClass(env, "java/lang/Integer");
    jmethodID valueOf = (*env)->GetStaticMethodID(env, integerClass, "valueOf", "(I)Ljava/lang/Integer;");
    errorCount = (*env)->CallStaticObjectMethod(env, integerClass, valueOf, (jint) *options->error_count);
  }

  jclass parseResultClass = (*env)->FindClass(env, "org/herb/ParseResult");
  jmethodID constructor = (*env)->GetMethodID(
      env,
      parseResultClass,
      "<init>",
      "(Lorg/herb/ast/Node;Ljava/util/List;Ljava/lang/String;Ljava/lang/Integer;)V"
  );

  return (*env)->NewObject(env, parseResultClass, constructor, value, errorsList, source, errorCount);
}

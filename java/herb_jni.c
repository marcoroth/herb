#include "herb_jni.h"
#include "extension_helpers.h"

#include "../../src/include/extract.h"
#include "../../src/include/herb.h"
#include "../../src/include/macros.h"
#include "../../src/include/util/hb_arena.h"
#include "../../src/include/util/hb_buffer.h"

#include <stdlib.h>
#include <string.h>

JNIEXPORT jstring JNICALL
Java_org_herb_Herb_herbVersion(JNIEnv* env, jclass clazz) {
  const char* version = herb_version();

  return (*env)->NewStringUTF(env, version);
}

JNIEXPORT jstring JNICALL
Java_org_herb_Herb_prismVersion(JNIEnv* env, jclass clazz) {
  const char* version = herb_prism_version();

  return (*env)->NewStringUTF(env, version);
}

JNIEXPORT jobject JNICALL
Java_org_herb_Herb_parse(JNIEnv* env, jclass clazz, jstring source, jobject options) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  parser_options_T parser_options = HERB_DEFAULT_PARSER_OPTIONS;

  if (options != NULL) {
    jclass optionsClass = (*env)->GetObjectClass(env, options);
    jmethodID getTrackWhitespace =
        (*env)->GetMethodID(env, optionsClass, "isTrackWhitespace", "()Z");

    if (getTrackWhitespace != NULL) {
      jboolean trackWhitespace = (*env)->CallBooleanMethod(env, options, getTrackWhitespace);

      if (trackWhitespace == JNI_TRUE) {
        parser_options.track_whitespace = true;
      }
    }

    jmethodID getAnalyze =
        (*env)->GetMethodID(env, optionsClass, "isAnalyze", "()Z");

    if (getAnalyze != NULL) {
      jboolean analyze = (*env)->CallBooleanMethod(env, options, getAnalyze);

      if (analyze == JNI_FALSE) {
        parser_options.analyze = false;
      }
    }

    jmethodID getStrict =
        (*env)->GetMethodID(env, optionsClass, "isStrict", "()Z");

    if (getStrict != NULL) {
      jboolean strict = (*env)->CallBooleanMethod(env, options, getStrict);
      parser_options.strict = (strict == JNI_TRUE);
    }
  }

  hb_arena_T* arena = malloc(sizeof(hb_arena_T));

  if (!arena) {
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  if (!hb_arena_init(arena, KB(512))) {
    free(arena);
    (*env)->ReleaseStringUTFChars(env, source, src);

    return NULL;
  }

  AST_DOCUMENT_NODE_T* ast = herb_parse(src, &parser_options, arena);

  jobject result = CreateParseResult(env, ast, source);

  ast_node_free((AST_NODE_T*) ast);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

JNIEXPORT jobject JNICALL
Java_org_herb_Herb_lex(JNIEnv* env, jclass clazz, jstring source) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  hb_arena_T* arena = malloc(sizeof(hb_arena_T));
  if (!arena) {
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  if (!hb_arena_init(arena, KB(512))) {
    free(arena);
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  herb_lex_result_T* lex_result = herb_lex(src, arena);

  if (!lex_result) {
    hb_arena_free(arena);
    free(arena);
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  jobject result = CreateLexResult(env, lex_result->tokens, source);

  herb_free_lex_result(&lex_result);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

JNIEXPORT jstring JNICALL
Java_org_herb_Herb_extractRuby(JNIEnv* env, jclass clazz, jstring source, jobject options) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(src))) {
    (*env)->ReleaseStringUTFChars(env, source, src);

    return NULL;
  }

  herb_extract_ruby_options_T extract_options = HERB_EXTRACT_RUBY_DEFAULT_OPTIONS;

  if (options != NULL) {
    jclass optionsClass = (*env)->GetObjectClass(env, options);

    jmethodID getSemicolons = (*env)->GetMethodID(env, optionsClass, "isSemicolons", "()Z");
    if (getSemicolons != NULL) {
      jboolean semicolons = (*env)->CallBooleanMethod(env, options, getSemicolons);
      extract_options.semicolons = (semicolons == JNI_TRUE);
    }

    jmethodID getComments = (*env)->GetMethodID(env, optionsClass, "isComments", "()Z");
    if (getComments != NULL) {
      jboolean comments = (*env)->CallBooleanMethod(env, options, getComments);
      extract_options.comments = (comments == JNI_TRUE);
    }

    jmethodID getPreservePositions = (*env)->GetMethodID(env, optionsClass, "isPreservePositions", "()Z");
    if (getPreservePositions != NULL) {
      jboolean preservePositions = (*env)->CallBooleanMethod(env, options, getPreservePositions);
      extract_options.preserve_positions = (preservePositions == JNI_TRUE);
    }
  }

  herb_extract_ruby_to_buffer_with_options(src, &output, &extract_options);

  jstring result = (*env)->NewStringUTF(env, output.value);

  free(output.value);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

JNIEXPORT jstring JNICALL
Java_org_herb_Herb_extractHTML(JNIEnv* env, jclass clazz, jstring source) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(src))) {
    (*env)->ReleaseStringUTFChars(env, source, src);

    return NULL;
  }

  herb_extract_html_to_buffer(src, &output);

  jstring result = (*env)->NewStringUTF(env, output.value);

  free(output.value);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

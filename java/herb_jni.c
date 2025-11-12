#include "herb_jni.h"
#include "extension_helpers.h"

#include "../../src/include/analyze.h"
#include "../../src/include/herb.h"
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

  parser_options_T* parser_options = NULL;
  parser_options_T opts = { 0 };

  if (options != NULL) {
    jclass optionsClass = (*env)->GetObjectClass(env, options);
    jmethodID getTrackWhitespace =
        (*env)->GetMethodID(env, optionsClass, "isTrackWhitespace", "()Z");

    if (getTrackWhitespace != NULL) {
      jboolean trackWhitespace = (*env)->CallBooleanMethod(env, options, getTrackWhitespace);

      if (trackWhitespace == JNI_TRUE) {
        opts.track_whitespace = true;
        parser_options = &opts;
      }
    }
  }

  AST_DOCUMENT_NODE_T* ast = herb_parse(src, parser_options);
  herb_analyze_parse_tree(ast, src);

  jobject result = CreateParseResult(env, ast, source);

  ast_node_free((AST_NODE_T*) ast);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

JNIEXPORT jobject JNICALL
Java_org_herb_Herb_lex(JNIEnv* env, jclass clazz, jstring source) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  hb_array_T* tokens = herb_lex(src);

  jobject result = CreateLexResult(env, tokens, source);

  herb_free_tokens(&tokens);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

JNIEXPORT jstring JNICALL
Java_org_herb_Herb_extractRuby(JNIEnv* env, jclass clazz, jstring source) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(src))) {
    (*env)->ReleaseStringUTFChars(env, source, src);

    return NULL;
  }

  herb_extract_ruby_to_buffer(src, &output);

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

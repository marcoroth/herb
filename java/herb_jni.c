#include "herb_jni.h"
#include "extension_helpers.h"

#include "../../src/include/extract.h"
#include "../../src/include/herb.h"
#include "../../src/include/util/hb_allocator.h"
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

    jmethodID getActionViewHelpers =
        (*env)->GetMethodID(env, optionsClass, "isActionViewHelpers", "()Z");

    if (getActionViewHelpers != NULL) {
      jboolean actionViewHelpers = (*env)->CallBooleanMethod(env, options, getActionViewHelpers);
      parser_options.action_view_helpers = (actionViewHelpers == JNI_TRUE);
    }
  }

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  AST_DOCUMENT_NODE_T* ast = herb_parse(src, &parser_options, &allocator);

  jobject result = CreateParseResult(env, ast, source);

  ast_node_free((AST_NODE_T*) ast, &allocator);
  hb_allocator_destroy(&allocator);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

JNIEXPORT jobject JNICALL
Java_org_herb_Herb_lex(JNIEnv* env, jclass clazz, jstring source) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  hb_array_T* tokens = herb_lex(src, &allocator);

  jobject result = CreateLexResult(env, tokens, source);

  herb_free_tokens(&tokens, &allocator);
  hb_allocator_destroy(&allocator);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

JNIEXPORT jstring JNICALL
Java_org_herb_Herb_extractRuby(JNIEnv* env, jclass clazz, jstring source, jobject options) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(src), &allocator)) {
    hb_allocator_destroy(&allocator);
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

  herb_extract_ruby_to_buffer_with_options(src, &output, &extract_options, &allocator);

  jstring result = (*env)->NewStringUTF(env, output.value);

  hb_buffer_free(&output);
  hb_allocator_destroy(&allocator);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

JNIEXPORT jstring JNICALL
Java_org_herb_Herb_extractHTML(JNIEnv* env, jclass clazz, jstring source) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);

  hb_allocator_T allocator;
  if (!hb_allocator_init(&allocator, HB_ALLOCATOR_ARENA)) {
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  hb_buffer_T output;

  if (!hb_buffer_init(&output, strlen(src), &allocator)) {
    hb_allocator_destroy(&allocator);
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  herb_extract_html_to_buffer(src, &output, &allocator);

  jstring result = (*env)->NewStringUTF(env, output.value);

  hb_buffer_free(&output);
  hb_allocator_destroy(&allocator);
  (*env)->ReleaseStringUTFChars(env, source, src);

  return result;
}

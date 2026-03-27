#include "herb_jni.h"
#include "extension_helpers.h"

#include "../../src/include/extract.h"
#include "../../src/include/herb.h"
#include "../../src/include/lib/hb_allocator.h"
#include "../../src/include/lib/hb_buffer.h"

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

    jmethodID getRenderNodes =
        (*env)->GetMethodID(env, optionsClass, "isRenderNodes", "()Z");

    if (getRenderNodes != NULL) {
      jboolean renderNodes = (*env)->CallBooleanMethod(env, options, getRenderNodes);
      parser_options.render_nodes = (renderNodes == JNI_TRUE);
    }

    jmethodID getStrictLocals =
        (*env)->GetMethodID(env, optionsClass, "isStrictLocals", "()Z");

    if (getStrictLocals != NULL) {
      jboolean strictLocals = (*env)->CallBooleanMethod(env, options, getStrictLocals);
      parser_options.strict_locals = (strictLocals == JNI_TRUE);
    }

    jmethodID getPrismNodes =
        (*env)->GetMethodID(env, optionsClass, "isPrismNodes", "()Z");

    if (getPrismNodes != NULL) {
      jboolean prismNodes = (*env)->CallBooleanMethod(env, options, getPrismNodes);
      parser_options.prism_nodes = (prismNodes == JNI_TRUE);
    }

    jmethodID getPrismNodesDeep =
        (*env)->GetMethodID(env, optionsClass, "isPrismNodesDeep", "()Z");

    if (getPrismNodesDeep != NULL) {
      jboolean prismNodesDeep = (*env)->CallBooleanMethod(env, options, getPrismNodesDeep);
      parser_options.prism_nodes_deep = (prismNodesDeep == JNI_TRUE);
    }

    jmethodID getPrismProgram =
        (*env)->GetMethodID(env, optionsClass, "isPrismProgram", "()Z");

    if (getPrismProgram != NULL) {
      jboolean prismProgram = (*env)->CallBooleanMethod(env, options, getPrismProgram);
      parser_options.prism_program = (prismProgram == JNI_TRUE);
    }

    jmethodID getDotNotationTags =
        (*env)->GetMethodID(env, optionsClass, "isDotNotationTags", "()Z");

    if (getDotNotationTags != NULL) {
      jboolean dotNotationTags = (*env)->CallBooleanMethod(env, options, getDotNotationTags);
      parser_options.dot_notation_tags = (dotNotationTags == JNI_TRUE);
    }

    jmethodID getHtml =
        (*env)->GetMethodID(env, optionsClass, "isHtml", "()Z");

    if (getHtml != NULL) {
      jboolean html = (*env)->CallBooleanMethod(env, options, getHtml);
      parser_options.html = (html == JNI_TRUE);
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

JNIEXPORT jbyteArray JNICALL
Java_org_herb_Herb_parseRuby(JNIEnv* env, jclass clazz, jstring source) {
  const char* src = (*env)->GetStringUTFChars(env, source, 0);
  size_t src_len = strlen(src);

  herb_ruby_parse_result_T* parse_result = herb_parse_ruby(src, src_len);

  if (!parse_result) {
    (*env)->ReleaseStringUTFChars(env, source, src);
    return NULL;
  }

  pm_buffer_t buffer = { 0 };
  pm_serialize(&parse_result->parser, parse_result->root, &buffer);

  jbyteArray result = NULL;

  if (buffer.length > 0) {
    result = (*env)->NewByteArray(env, (jsize) buffer.length);
    (*env)->SetByteArrayRegion(env, result, 0, (jsize) buffer.length, (const jbyte*) buffer.value);
  }

  pm_buffer_free(&buffer);
  herb_free_ruby_parse_result(parse_result);
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

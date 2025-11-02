#ifndef HERB_JNI_H
#define HERB_JNI_H

#include <jni.h>

#ifdef __cplusplus
extern "C" {
#endif

JNIEXPORT jstring JNICALL Java_com_herb_Herb_version(JNIEnv*, jobject);
JNIEXPORT jstring JNICALL Java_com_herb_Herb_prismVersion(JNIEnv*, jobject);
JNIEXPORT jobject JNICALL Java_com_herb_Herb_parse(JNIEnv*, jobject, jstring, jobject);
JNIEXPORT jobject JNICALL Java_com_herb_Herb_lex(JNIEnv*, jobject, jstring);
JNIEXPORT jstring JNICALL Java_com_herb_Herb_extractRuby(JNIEnv*, jobject, jstring);
JNIEXPORT jstring JNICALL Java_com_herb_Herb_extractHTML(JNIEnv*, jobject, jstring);

#ifdef __cplusplus
}
#endif

#endif

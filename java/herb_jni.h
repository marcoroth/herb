#ifndef HERB_JNI_H
#define HERB_JNI_H

#include <jni.h>

#ifdef __cplusplus
extern "C" {
#endif

JNIEXPORT jstring JNICALL Java_org_herb_Herb_herbVersion(JNIEnv*, jclass);
JNIEXPORT jstring JNICALL Java_org_herb_Herb_prismVersion(JNIEnv*, jclass);
JNIEXPORT jobject JNICALL Java_org_herb_Herb_parse(JNIEnv*, jclass, jstring, jobject);
JNIEXPORT jobject JNICALL Java_org_herb_Herb_lex(JNIEnv*, jclass, jstring);
JNIEXPORT jstring JNICALL Java_org_herb_Herb_extractRuby(JNIEnv*, jclass, jstring, jobject);
JNIEXPORT jstring JNICALL Java_org_herb_Herb_extractHTML(JNIEnv*, jclass, jstring);

#ifdef __cplusplus
}
#endif

#endif

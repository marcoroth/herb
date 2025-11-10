// Go bindings wrapper - mirrors Java approach (herb_jni.h pattern)
// This header exposes herb's public API without including prism.h
#ifndef HERB_GO_H
#define HERB_GO_H

#ifdef __cplusplus
extern "C" {
#endif

// Forward declarations - opaque types for Go (no struct definitions)
typedef struct hb_array_T hb_array_T;
typedef struct hb_buffer_T hb_buffer_T;
typedef struct AST_DOCUMENT_NODE_STRUCT AST_DOCUMENT_NODE_T;
typedef struct parser_options_T parser_options_T;

// Extract language enum (from extract.h)
typedef enum {
  HERB_EXTRACT_LANGUAGE_RUBY,
  HERB_EXTRACT_LANGUAGE_HTML,
} herb_extract_language_T;

// Public herb API (from herb.h)
void herb_lex_to_buffer(const char* source, hb_buffer_T* output);
hb_array_T* herb_lex(const char* source);
hb_array_T* herb_lex_file(const char* path);
AST_DOCUMENT_NODE_T* herb_parse(const char* source, parser_options_T* options);
const char* herb_version(void);
const char* herb_prism_version(void);
void herb_free_tokens(hb_array_T** tokens);

// Extract API (from extract.h)
void herb_extract_ruby_to_buffer(const char* source, hb_buffer_T* output);
void herb_extract_html_to_buffer(const char* source, hb_buffer_T* output);
char* herb_extract_ruby_with_semicolons(const char* source);
void herb_extract_ruby_to_buffer_with_semicolons(const char* source, hb_buffer_T* output);
char* herb_extract(const char* source, herb_extract_language_T language);
char* herb_extract_from_file(const char* path, herb_extract_language_T language);

#ifdef __cplusplus
}
#endif

#endif

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

// Token structures (needed for inspection)
typedef struct POSITION_STRUCT {
  unsigned int line;
  unsigned int column;
} position_T;

typedef struct RANGE_STRUCT {
  unsigned int from;
  unsigned int to;
} range_T;

typedef struct LOCATION_STRUCT {
  position_T start;
  position_T end;
} location_T;

typedef enum {
  TOKEN_WHITESPACE, TOKEN_NBSP, TOKEN_NEWLINE, TOKEN_IDENTIFIER,
  TOKEN_HTML_DOCTYPE, TOKEN_XML_DECLARATION, TOKEN_XML_DECLARATION_END,
  TOKEN_CDATA_START, TOKEN_CDATA_END,
  TOKEN_HTML_TAG_START, TOKEN_HTML_TAG_START_CLOSE, TOKEN_HTML_TAG_END, TOKEN_HTML_TAG_SELF_CLOSE,
  TOKEN_HTML_COMMENT_START, TOKEN_HTML_COMMENT_END,
  TOKEN_ERB_START, TOKEN_ERB_CONTENT, TOKEN_ERB_END,
  TOKEN_LT, TOKEN_SLASH, TOKEN_EQUALS, TOKEN_QUOTE, TOKEN_BACKTICK, TOKEN_BACKSLASH,
  TOKEN_DASH, TOKEN_UNDERSCORE, TOKEN_EXCLAMATION, TOKEN_SEMICOLON, TOKEN_COLON,
  TOKEN_AT, TOKEN_PERCENT, TOKEN_AMPERSAND,
  TOKEN_CHARACTER, TOKEN_ERROR, TOKEN_EOF,
} token_type_T;

typedef struct TOKEN_STRUCT {
  char* value;
  range_T range;
  location_T location;
  token_type_T type;
} token_T;

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

// Array helper functions
unsigned long hb_array_size(const hb_array_T* array);
void* hb_array_get(const hb_array_T* array, unsigned long index);

// Token helper functions
const char* token_type_to_string(token_type_T type);

#ifdef __cplusplus
}
#endif

#endif

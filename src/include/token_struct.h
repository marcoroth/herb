#ifndef HERB_TOKEN_STRUCT_H
#define HERB_TOKEN_STRUCT_H

#include "location.h"
#include "range.h"

typedef enum {
  TOKEN_WHITESPACE, // ' '
  TOKEN_NBSP,       // \xC2\xA0
  TOKEN_NEWLINE,    // \n
  TOKEN_IDENTIFIER,

  TOKEN_HTML_DOCTYPE,        // <!DOCTYPE, <!doctype, <!DoCtYpE, <!dOcTyPe
  TOKEN_XML_DECLARATION,     // <?xml
  TOKEN_XML_DECLARATION_END, // ?>
  TOKEN_CDATA_START,         // <![CDATA[
  TOKEN_CDATA_END,           // ]]>

  TOKEN_HTML_TAG_START,       // <
  TOKEN_HTML_TAG_START_CLOSE, // </
  TOKEN_HTML_TAG_END,         // >
  TOKEN_HTML_TAG_SELF_CLOSE,  // />

  TOKEN_HTML_COMMENT_START,       // <!--
  TOKEN_HTML_COMMENT_END,         // -->
  TOKEN_HTML_COMMENT_INVALID_END, // --!>

  TOKEN_ERB_START,   // <%, <%=, <%%=, <%#, <%-, <%==, <%%
  TOKEN_ERB_CONTENT, // Ruby Code
  TOKEN_ERB_END,     // %>, -%>, %%>

  TOKEN_LT,          // <
  TOKEN_SLASH,       // /
  TOKEN_EQUALS,      // =
  TOKEN_QUOTE,       // ", '
  TOKEN_BACKTICK,    // `
  TOKEN_BACKSLASH,   // backslash
  TOKEN_DASH,        // -
  TOKEN_UNDERSCORE,  // _
  TOKEN_EXCLAMATION, // !
  TOKEN_SEMICOLON,   // ;
  TOKEN_COLON,       // :
  TOKEN_AT,          // @
  TOKEN_PERCENT,     // %
  TOKEN_AMPERSAND,   // &

  TOKEN_CHARACTER,
  TOKEN_ERROR,
  TOKEN_EOF,
} token_type_T;

// Sentinel value for variadic functions
#define TOKEN_SENTINEL 99999999

typedef struct TOKEN_STRUCT {
  char* value;
  range_T range;
  location_T location;
  token_type_T type;
} token_T;

#endif

#ifndef ERBX_TOKEN_H
#define ERBX_TOKEN_H

typedef struct TOKEN_STRUCT {
  char* value;
  enum {
    TOKEN_ATTRIBUTE_NAME,
    TOKEN_ATTRIBUTE_VALUE,
    TOKEN_DOUBLE_QUOTE,
    TOKEN_END_TAG_END,
    TOKEN_END_TAG_START,
    TOKEN_EOF,
    TOKEN_EQUALS,
    TOKEN_ID,
    TOKEN_NEWLINE,
    TOKEN_SINGLE_QUOTE,
    TOKEN_SPACE,
    TOKEN_START_TAG_END_VOID,
    TOKEN_START_TAG_END,
    TOKEN_START_TAG_START,
    TOKEN_TAG_END,
    TOKEN_TAG_NAME,
    TOKEN_TEXT_CONTENT,
    TOKEN_WHITESPACE,
  } type;
} token_T;

token_T* init_token(char* value, int type);
char* token_to_string(token_T* token);
const char* token_type_to_string(int type);

#endif

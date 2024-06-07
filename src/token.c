#include "include/token.h"

#include <stdlib.h>
#include <string.h>
#include <stdio.h>

token_T* token_init(char* value, int type) {
  token_T* token = calloc(1, sizeof(struct TOKEN_STRUCT));
  token->value = value;
  token->type = type;

  return token;
}

const char* token_type_to_string(int type) {
  switch(type) {
    case TOKEN_ATTRIBUTE_NAME: return "TOKEN_ATTRIBUTE_NAME";
    case TOKEN_ATTRIBUTE_VALUE: return "TOKEN_ATTRIBUTE_VALUE";
    case TOKEN_DOUBLE_QUOTE: return "TOKEN_DOUBLE_QUOTE";
    case TOKEN_END_TAG_END: return "TOKEN_END_TAG_END";
    case TOKEN_END_TAG_START: return "TOKEN_END_TAG_START";
    case TOKEN_EOF: return "TOKEN_EOF";
    case TOKEN_EQUALS: return "TOKEN_EQUALS";
    case TOKEN_ID: return "TOKEN_ID";
    case TOKEN_NEWLINE: return "TOKEN_NEWLINE";
    case TOKEN_SINGLE_QUOTE: return "TOKEN_SINGLE_QUOTE";
    case TOKEN_SPACE: return "TOKEN_SPACE";
    case TOKEN_START_TAG_END_VOID: return "TOKEN_START_TAG_END_VOID";
    case TOKEN_START_TAG_END: return "TOKEN_START_TAG_END";
    case TOKEN_START_TAG_START: return "TOKEN_START_TAG_START";
    case TOKEN_TAG_END: return "TOKEN_TAG_END";
    case TOKEN_TAG_NAME: return "TOKEN_TAG_NAME";
    case TOKEN_TEXT_CONTENT: return "TOKEN_TEXT_CONTENT";
    case TOKEN_WHITESPACE: return "TOKEN_WHITESPACE";

    default: {
      printf("Unknown token type: %d\n", type);
      exit(1);
    }
  }

  return "don't know token";
}

char* token_to_string(token_T* token) {
  const char* type_string = token_type_to_string(token->type);
  const char* template = "<type='%s', int_type='%d', value='%s'>";

  char* string = calloc(strlen(type_string) + strlen(template) + 8, sizeof(char));
  sprintf(string, template, type_string, token->type, token->value);

  return string;
}

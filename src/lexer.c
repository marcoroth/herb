#include "include/lexer.h"
#include "include/macros.h"
#include "include/token.h"
#include "include/util.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

size_t lexer_sizeof(void) { return sizeof(struct LEXER_STRUCT); }

lexer_T *lexer_init(char *source) {
  lexer_T *lexer = calloc(1, lexer_sizeof());

  lexer->state = STATE_NONE;
  lexer->source = source;
  lexer->source_length = strlen(source);
  lexer->current_position = 0;
  lexer->current_column = 0;
  lexer->current_line = 1;
  lexer->current_character = source[lexer->current_position];

  return lexer;
}

char lexer_peek(lexer_T *lexer, int offset) {
  return lexer
      ->source[MIN(lexer->current_position + offset, lexer->source_length)];
}

char lexer_backtrack(lexer_T *lexer, int offset) {
  return lexer->source[MAX(lexer->current_position - offset, 0)];
}

void lexer_advance(lexer_T *lexer) {
  if (lexer->current_position < lexer->source_length &&
      lexer->current_character != '\0') {

    if (isnewline(lexer->current_character)) {
      lexer->current_line += 1;
      lexer->current_column = 1;
    } else {
      lexer->current_column += 1;
    }

    lexer->current_position += 1;
    lexer->current_character = lexer->source[lexer->current_position];
  }
}

token_T *lexer_advance_current(lexer_T *lexer, int type) {
  char *value = calloc(2, sizeof(char));
  value[0] = lexer->current_character;
  value[1] = '\0';

  lexer_advance(lexer);
  token_T *token = token_init(value, type, lexer);

  return token;
}

void lexer_skip_whitespace(lexer_T *lexer) {
  while (lexer->current_character == 13 || lexer->current_character == 10 ||
         lexer->current_character == ' ' || lexer->current_character == '\t') {
    lexer_advance(lexer);
  }
}

token_T *lexer_parse_newline(lexer_T *lexer) {
  char *value = calloc(2, sizeof(char));
  value[0] = lexer->current_character;
  value[1] = '\0';

  lexer_advance(lexer);

  return token_init(value, TOKEN_NEWLINE, lexer);
}

token_T *lexer_parse_whitespace(lexer_T *lexer) {
  char *value = calloc(1, sizeof(char));

  while (iswhitespace(lexer->current_character) &&
         lexer->current_character != '\0') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]){lexer->current_character, 0});
    lexer_advance(lexer);
  }

  return token_init(value, TOKEN_WHITESPACE, lexer);
}

token_T *lexer_parse_tag_name(lexer_T *lexer) {
  char *value = calloc(1, sizeof(char));

  while (lexer->current_character != ' ' && lexer->current_character != '>') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]){lexer->current_character, 0});
    lexer_advance(lexer);
  }

  return token_init(value, TOKEN_TAG_NAME, lexer);
}

token_T *lexer_parse_attribute_name(lexer_T *lexer) {
  char *value = calloc(1, sizeof(char));
  char character = 0;

  while ((character = lexer->current_character) != '=' && character != ' ') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]){character, 0});
    lexer_advance(lexer);
  }

  if (character == ' ') {
    // boolean attribute
    lexer->state = STATE_TAG_ATTRIBUTES;
  } else {
    // value attribute
    lexer->state = STATE_ATTRIBUTE_START;
  }

  return token_init(value, TOKEN_ATTRIBUTE_NAME, lexer);
}

token_T *lexer_parse_attribute_value(lexer_T *lexer) {
  char *value = calloc(1, sizeof(char));
  char quote = lexer_backtrack(lexer, 1);

  while (lexer->current_character != quote) {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]){lexer->current_character, 0});
    lexer_advance(lexer);
  }

  return token_init(value, TOKEN_ATTRIBUTE_VALUE, lexer);
}

token_T *lexer_parse_text_content(lexer_T *lexer) {
  char *value = calloc(1, sizeof(char));

  while (lexer->current_character != '<') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]){lexer->current_character, 0});
    lexer_advance(lexer);
  }

  return token_init(value, TOKEN_TEXT_CONTENT, lexer);
}

token_T *lexer_next_token(lexer_T *lexer) {
  while (lexer->current_character != '\0') {

    // printf("STATE: %u\n", lexer->state);
    // printf("Current character: %c\n", lexer->current_character);

    switch (lexer->state) {
    case STATE_NONE: {
      if (iswhitespace(lexer->current_character) ||
          isnewline(lexer->current_character)) {
        lexer_skip_whitespace(lexer);
      }

      switch (lexer->current_character) {
      case '<': {
        if (lexer_peek(lexer, 1) == '/') {
          lexer->state = STATE_START_TAG_START;
          lexer_advance(lexer);
          lexer_advance(lexer);

          return token_init("</", TOKEN_END_TAG_START, lexer);
        }

        lexer->state = STATE_START_TAG_START;
        lexer_advance(lexer);

        return token_init("<", TOKEN_START_TAG_START, lexer);
      } break;

      case '\0':
        break;
      default: {
        printf("[Lexer] Unexpected character `%c`\n", lexer->current_character);
        exit(1);
        break;
      }
      }
    } break;

    case STATE_START_TAG_START: {
      lexer->state = STATE_TAG_ATTRIBUTES;
      return lexer_parse_tag_name(lexer);
    } break;

    case STATE_END_TAG_START: {
      lexer->state = STATE_END_TAG_END;
      return lexer_parse_tag_name(lexer);
    } break;

    case STATE_END_TAG_END: {
      lexer->state = STATE_NONE;
      return lexer_advance_current(lexer, TOKEN_END_TAG_END);
    } break;

    case STATE_ATTRIBUTE_START: {
      switch (lexer->current_character) {
      case '=': {
        lexer->state = STATE_ATTRIBUTE_VALUE_START;
        return lexer_advance_current(lexer, TOKEN_EQUALS);
      } break;

      case ' ': {
        lexer->state = STATE_TAG_ATTRIBUTES;
        return lexer_advance_current(lexer, TOKEN_SINGLE_QUOTE);
      } break;

      default: {
        printf("[Lexer] Unexpected character in STATE_ATTRIBUTE_START `%c`\n",
               lexer->current_character);
        exit(1);
        break;
      }
      }
    } break;

    case STATE_TAG_ATTRIBUTES: {
      if (iswhitespace(lexer->current_character) ||
          isnewline(lexer->current_character)) {
        lexer_skip_whitespace(lexer);
      }

      if (isalpha(lexer->current_character)) {
        return lexer_parse_attribute_name(lexer);
      }

      switch (lexer->current_character) {
      case '/': {
        if (lexer_peek(lexer, 1) == '>') {
          lexer->state = STATE_NONE;
          lexer_advance(lexer);
          lexer_advance(lexer);

          return token_init("/>", TOKEN_START_TAG_END_VOID, lexer);
        } else {
          // TODO: raise
        }
      } break;

      case '>': {
        lexer->state = STATE_ELEMENT_CHILDREN;
        return lexer_advance_current(lexer, TOKEN_START_TAG_END);
      } break;
      }
    } break;

    case STATE_ELEMENT_CHILDREN: {
      if (iswhitespace(lexer->current_character) ||
          isnewline(lexer->current_character)) {
        lexer_skip_whitespace(lexer);
      }

      if (lexer->current_character == '<') {
        if (lexer_peek(lexer, 1) == '/') {
          lexer->state = STATE_END_TAG_START;
          lexer_advance(lexer);
          lexer_advance(lexer);

          return token_init("</", TOKEN_END_TAG_START, lexer);
        } else {
          lexer->state = STATE_START_TAG_START;
          lexer_advance(lexer);

          return token_init("<", TOKEN_START_TAG_START, lexer);
        }
      } else {
        return lexer_parse_text_content(lexer);
      }
    } break;

    case STATE_ATTRIBUTE_VALUE_START: {
      switch (lexer->current_character) {
      case '"': {
        lexer->state = STATE_ATTRIBUTE_VALUE;
        return lexer_advance_current(lexer, TOKEN_DOUBLE_QUOTE);
      } break;

      case '\'': {
        lexer->state = STATE_ATTRIBUTE_VALUE;
        return lexer_advance_current(lexer, TOKEN_SINGLE_QUOTE);
      } break;
      }

    } break;

    case STATE_ATTRIBUTE_VALUE: {
      if (lexer->current_character == '"' || lexer->current_character == '\'') {
        lexer->state = STATE_ATTRIBUTE_VALUE_END;
        return token_init("\0", TOKEN_ATTRIBUTE_VALUE, lexer);
      }

      if (isalpha(lexer->current_character) ||
          iswhitespace(lexer->current_character)) {
        lexer->state = STATE_ATTRIBUTE_VALUE_END;
        return lexer_parse_attribute_value(lexer);
      }
    } break;

    case STATE_ATTRIBUTE_VALUE_END: {
      switch (lexer->current_character) {
      case '"': {
        lexer->state = STATE_TAG_ATTRIBUTES;
        return lexer_advance_current(lexer, TOKEN_DOUBLE_QUOTE);
      } break;

      case '\'': {
        lexer->state = STATE_TAG_ATTRIBUTES;
        return lexer_advance_current(lexer, TOKEN_SINGLE_QUOTE);
      } break;

      default: {
        printf(
            "[Lexer] Unexpected character in STATE_ATTRIBUTE_VALUE_END `%c`\n",
            lexer->current_character);
        exit(1);
        break;
      }
      }

      return token_init(0, TOKEN_ATTRIBUTE_VALUE, lexer);
    } break;
    default: {
      if (iswhitespace(lexer->current_character) ||
          isnewline(lexer->current_character)) {
        lexer_skip_whitespace(lexer);
      }
    }
    }
  }

  return token_init("\0", TOKEN_EOF, lexer);
}

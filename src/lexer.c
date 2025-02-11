#include "include/lexer.h"
#include "include/macros.h"
#include "include/token.h"
#include "include/util.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

char* lexer_state_to_string(lexer_T* lexer) {
  switch (lexer->state) {
    case STATE_DATA: return "STATE_DATA";
    case STATE_HTML_TAG_OPEN: return "STATE_HTML_TAG_OPEN";
    case STATE_HTML_ATTRIBUTES: return "STATE_HTML_ATTRIBUTES";
    case STATE_HTML_ATTRIBUTE_NAME: return "STATE_HTML_ATTRIBUTE_NAME";
    case STATE_HTML_ATTRIBUTE_EQUALS: return "STATE_HTML_ATTRIBUTE_EQUALS";
    case STATE_HTML_ATTRIBUTE_VALUE: return "STATE_HTML_ATTRIBUTE_VALUE";
    case STATE_ERB_OPEN: return "STATE_ERB_OPEN";
    case STATE_HTML_COMMENT_OPEN: return "STATE_HTML_COMMENT_OPEN";
    case STATE_HTML_COMMENT_CLOSE: return "STATE_HTML_COMMENT_CLOSE";
    case STATE_HTML_TAG_NAME: return "STATE_HTML_TAG_NAME";
    case STATE_HTML_TAG_CLOSE: return "STATE_HTML_TAG_CLOSE";
  }
}

size_t lexer_sizeof(void) {
  return sizeof(struct LEXER_STRUCT);
}

lexer_T* lexer_init(char* source) {
  lexer_T* lexer = calloc(1, lexer_sizeof());

  lexer->state = STATE_DATA;
  lexer->source = source;
  lexer->source_length = strlen(source);
  lexer->current_position = 0;
  lexer->current_column = 0;
  lexer->current_line = 1;
  lexer->current_character = source[lexer->current_position];

  return lexer;
}

char lexer_peek(lexer_T* lexer, int offset) {
  return lexer->source[MIN(lexer->current_position + offset, lexer->source_length)];
}

char lexer_backtrack(lexer_T* lexer, int offset) {
  return lexer->source[MAX(lexer->current_position - offset, 0)];
}

void lexer_advance(lexer_T* lexer) {
  if (lexer->current_position < lexer->source_length && lexer->current_character != '\0') {

    if (is_newline(lexer->current_character)) {
      lexer->current_line += 1;
      lexer->current_column = 1;
    } else {
      lexer->current_column += 1;
    }

    lexer->current_position += 1;
    lexer->current_character = lexer->source[lexer->current_position];
  }
}

token_T* lexer_advance_current(lexer_T* lexer, int type) {
  char* value = calloc(2, sizeof(char));
  value[0] = lexer->current_character;
  value[1] = '\0';

  lexer_advance(lexer);
  token_T* token = token_init(value, type, lexer);

  return token;
}

void lexer_skip_whitespace(lexer_T* lexer) {
  while (lexer->current_character == 13 || lexer->current_character == 10 || lexer->current_character == ' ' ||
         lexer->current_character == '\t') {
    lexer_advance(lexer);
  }
}

token_T* lexer_parse_newline(lexer_T* lexer) {
  char* value = calloc(2, sizeof(char));
  value[0] = lexer->current_character;
  value[1] = '\0';

  lexer_advance(lexer);

  return token_init(value, TOKEN_NEWLINE, lexer);
}

token_T* lexer_parse_whitespace(lexer_T* lexer) {
  char* value = calloc(1, sizeof(char));

  while (is_whitespace(lexer->current_character) && lexer->current_character != '\0') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]) {lexer->current_character, 0});
    lexer_advance(lexer);
  }

  return token_init(value, TOKEN_WHITESPACE, lexer);
}

token_T* lexer_parse_tag_name(lexer_T* lexer) {
  char* value = calloc(1, sizeof(char));

  while (lexer->current_character != ' ' && lexer->current_character != '>') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]) {lexer->current_character, 0});
    lexer_advance(lexer);
  }

  return token_init(value, TOKEN_HTML_TAG_NAME, lexer);
}

token_T* lexer_parse_attribute_name(lexer_T* lexer) {
  char* value = calloc(1, sizeof(char));
  char character = 0;

  while ((character = lexer->current_character) != '=' && character != ' ' && character != '>') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]) {character, 0});
    lexer_advance(lexer);
  }

  return token_init(value, TOKEN_HTML_ATTRIBUTE_NAME, lexer);
}

token_T* lexer_parse_attribute_value(lexer_T* lexer) {
  char* value = calloc(1, sizeof(char));
  char quote = lexer_backtrack(lexer, 1);

  if (quote != '"' && quote != '\'') {
    quote = ' ';
  }

  while (lexer->current_character != quote) {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]) {lexer->current_character, 0});
    lexer_advance(lexer);
  }

  lexer->state = STATE_HTML_ATTRIBUTE_VALUE;

  return token_init(value, TOKEN_HTML_ATTRIBUTE_VALUE, lexer);
}

token_T* lexer_parse_text_content(lexer_T* lexer) {
  char* value = calloc(1, sizeof(char));

  while (lexer->current_character != '<') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]) {lexer->current_character, 0});
    lexer_advance(lexer);
  }

  return token_init(value, TOKEN_TEXT_CONTENT, lexer);
}

token_T* lexer_parse_html_comment_content(lexer_T* lexer) {
  char* value = calloc(1, sizeof(char));

  while (lexer->current_character != '-' && lexer_peek(lexer, 1) != '-' && lexer_peek(lexer, 2) != '>') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]) {lexer->current_character, 0});
    lexer_advance(lexer);
  }

  lexer_advance(lexer);

  lexer->state = STATE_HTML_COMMENT_CLOSE;

  return token_init(value, TOKEN_HTML_COMMENT_CONTENT, lexer);
}

token_T* lexer_handle_data_state(lexer_T* lexer) {
  switch (lexer->current_character) {
    case '\n': {
      lexer_advance(lexer);
      return token_init("\n", TOKEN_NEWLINE, lexer);
    } break;

    case '<': {
      const char next_character = lexer_peek(lexer, 1);

      switch (next_character) {
        case '%': {
          lexer->state = STATE_ERB_OPEN;
          lexer_advance(lexer);
          lexer_advance(lexer);
          return token_init("<%", TOKEN_ERB_START, lexer);
        } break;

        case '/': {
          lexer->state = STATE_HTML_TAG_CLOSE;
          lexer_advance(lexer);
          lexer_advance(lexer);
          return token_init("</", TOKEN_HTML_CLOSE_TAG_START, lexer);
        } break;

        case '!': {
          if (lexer_peek(lexer, 2) == '-' && lexer_peek(lexer, 3) == '-') {
            lexer_advance(lexer);
            lexer_advance(lexer);
            lexer_advance(lexer);
            lexer_advance(lexer);
            lexer->state = STATE_HTML_COMMENT_OPEN;
            return token_init("<!--", TOKEN_HTML_COMMENT_START, lexer);
          }

          // TODO: handle this case
          printf("lexer_handle_data_state: '%c'\n", lexer->current_character);
          exit(1);
        }

        default: {
          lexer->state = STATE_HTML_TAG_OPEN;
          lexer_advance(lexer);
          return token_init("<", TOKEN_HTML_TAG_START, lexer);
        }
      }
    } break;

    case '%': {
      if (lexer_peek(lexer, 1) == '>') {
        lexer->state = STATE_DATA;
        lexer_advance(lexer);
        lexer_advance(lexer);

        return token_init("%>", TOKEN_ERB_END, lexer);
      }

      printf("lexer_handle_html_attributes_state in '%%': '%c'\n", lexer_peek(lexer, 1));
      exit(1);
    } break;

    default: {
      return lexer_parse_text_content(lexer);
    }
  }
}

token_T* lexer_handle_erb_open_state(lexer_T* lexer) {
  char* value = calloc(1, sizeof(char));

  while (lexer->current_character != '%' && lexer_peek(lexer, 1) != '>') {
    value = realloc(value, (strlen(value) + 2) * sizeof(char));
    strcat(value, (char[]) {lexer->current_character, 0});
    lexer_advance(lexer);
  }

  lexer->state = STATE_DATA;

  return token_init(value, TOKEN_ERB_CONTENT, lexer);
}

// <div class="abc"></div>
//    ^
//
token_T* lexer_handle_html_attributes_state(lexer_T* lexer) {
  switch (lexer->current_character) {
    case ' ': {
      lexer_advance(lexer);
      return token_init(" ", TOKEN_WHITESPACE, lexer);
    } break;

    case '>': {
      lexer->state = STATE_DATA;
      lexer_advance(lexer);
      return token_init(">", TOKEN_HTML_TAG_END, lexer);
    } break;

    case '/': {
      if (lexer_peek(lexer, 1) == '>') {
        lexer->state = STATE_DATA;
        lexer_advance(lexer);
        lexer_advance(lexer);
        return token_init("/>", TOKEN_HTML_TAG_SELF_CLOSE, lexer);
      }

      // TODO: handle this case
      printf("lexer_handle_html_attributes_state in '/': '%c'\n", lexer_peek(lexer, 1));
      exit(1);
    } break;

    default: {
      lexer->state = STATE_HTML_ATTRIBUTE_NAME;
      return lexer_parse_attribute_name(lexer);
    }
  }
}

// <div class="hello"></div>
//    ^
//
token_T* lexer_handle_tag_name_state(lexer_T* lexer) {

  switch (lexer->current_character) {
    case ' ': {
      lexer_advance(lexer);
      lexer->state = STATE_HTML_ATTRIBUTES;
      return token_init(" ", TOKEN_WHITESPACE, lexer);
    } break;

    case '>': {
      lexer->state = STATE_DATA;
      lexer_advance(lexer);
      return token_init(">", TOKEN_HTML_TAG_END, lexer);
    } break;

    default: {
      printf("lexer_handle_tag_name_state ELSE: '%c'\n", lexer->current_character);
      exit(1);
    }
  }
}

// <div class="hello"></div>
//          ^
//
// <input required />
//               ^
//
token_T* lexer_handle_html_attribute_name_state(lexer_T* lexer) {
  switch (lexer->current_character) {
    case '=': {
      lexer_advance(lexer);
      lexer->state = STATE_HTML_ATTRIBUTE_EQUALS;
      return token_init("=", TOKEN_HTML_EQUALS, lexer);
    } break;

    case ' ': {
      lexer_advance(lexer);
      lexer->state = STATE_HTML_ATTRIBUTES;
      return token_init(" ", TOKEN_WHITESPACE, lexer);
    } break;

    case '/': {
      if (lexer_peek(lexer, 1) == '>') {
        lexer->state = STATE_HTML_TAG_CLOSE;
        lexer_advance(lexer);
        lexer_advance(lexer);
        return token_init("/>", TOKEN_HTML_TAG_SELF_CLOSE, lexer);
      }

      // TODO: handle this case
      printf("lexer_handle_html_attribute_name_state in '/': '%c'\n", lexer_peek(lexer, 1));
      exit(1);
    } break;

    case '>': {
      lexer_advance(lexer);
      lexer->state = STATE_DATA;
      return token_init(">", TOKEN_HTML_TAG_END, lexer);
    } break;

    default: {
      printf("lexer_handle_html_attribute_name_state: '%c'\n", lexer->current_character);
      exit(1);
    }
  }
}

token_T* lexer_handle_html_attribute_equals_state(lexer_T* lexer) {
  switch (lexer->current_character) {
    case '"': {
      lexer_advance(lexer);
      return token_init("\"", TOKEN_HTML_QUOTE, lexer);
    } break;

    case '\'': {
      lexer_advance(lexer);
      return token_init("'", TOKEN_HTML_QUOTE, lexer);
    } break;

    case ' ': {
      lexer_advance(lexer);
      lexer->state = STATE_HTML_ATTRIBUTES;
      return token_init(" ", TOKEN_WHITESPACE, lexer);
    } break;

    case '>': {
      lexer_advance(lexer);
      lexer->state = STATE_DATA;
      return token_init(">", TOKEN_HTML_TAG_END, lexer);
    } break;

    default: {
      return lexer_parse_attribute_value(lexer);
    }
  }
}

token_T* lexer_handle_html_attribute_value_state(lexer_T* lexer) {
  switch (lexer->current_character) {
    case '"': {
      lexer_advance(lexer);
      lexer->state = STATE_HTML_ATTRIBUTES;
      return token_init("\"", TOKEN_HTML_QUOTE, lexer);
    } break;

    case '\'': {
      lexer_advance(lexer);
      lexer->state = STATE_HTML_ATTRIBUTES;
      return token_init("'", TOKEN_HTML_QUOTE, lexer);
    } break;

    case ' ': {
      lexer_advance(lexer);
      lexer->state = STATE_HTML_ATTRIBUTES;
      return token_init(" ", TOKEN_WHITESPACE, lexer);
    }

    default: {
      printf("lexer_handle_html_attribute_value_state: '%c'\n", lexer->current_character);
      exit(1);
    }
  }
}

token_T* lexer_handle_html_tag_open_state(lexer_T* lexer) {
  switch (lexer->current_character) {
    case ' ': {
      exit(1);
    } break;

    default: {
      lexer->state = STATE_HTML_ATTRIBUTES;
      return lexer_parse_tag_name(lexer);
    }
  }
}

token_T* lexer_handle_html_tag_close_state(lexer_T* lexer) {
  switch (lexer->current_character) {
    case '>': {
      lexer_advance(lexer);
      lexer->state = STATE_DATA;
      return token_init(">", TOKEN_HTML_TAG_END, lexer);
    }

    default: {
      return lexer_parse_tag_name(lexer);
    }
  }
}

token_T* lexer_handle_html_comment_open_state(lexer_T* lexer) {
  return lexer_parse_html_comment_content(lexer);
}

token_T* lexer_handle_html_comment_close_state(lexer_T* lexer) {
  switch (lexer->current_character) {
    case '-': {
      if (lexer_peek(lexer, 1) == '-' && lexer_peek(lexer, 2) == '>') {
        lexer_advance(lexer);
        lexer_advance(lexer);
        lexer_advance(lexer);
        return token_init("-->", TOKEN_HTML_COMMENT_END, lexer);
      }

      // TODO: handle this case
      printf("lexer_handle_html_comment_close_state in '-': '%c' and '%c'\n",
          lexer_peek(lexer, 1),
          lexer_peek(lexer, 2));
      exit(1);
    }

    default: {
      printf("lexer_handle_html_comment_close_state: '%c'\n", lexer->current_character);
      exit(1);
    }
  }
}

token_T* lexer_next_token(lexer_T* lexer) {
  while (lexer->current_character != '\0') {
    switch (lexer->state) {
      case STATE_DATA: return lexer_handle_data_state(lexer);
      case STATE_HTML_TAG_OPEN: return lexer_handle_html_tag_open_state(lexer);
      case STATE_HTML_TAG_NAME: return lexer_handle_tag_name_state(lexer);
      case STATE_HTML_ATTRIBUTES: return lexer_handle_html_attributes_state(lexer);
      case STATE_HTML_ATTRIBUTE_NAME: return lexer_handle_html_attribute_name_state(lexer);
      case STATE_HTML_ATTRIBUTE_EQUALS: return lexer_handle_html_attribute_equals_state(lexer);
      case STATE_HTML_ATTRIBUTE_VALUE: return lexer_handle_html_attribute_value_state(lexer);
      case STATE_HTML_TAG_CLOSE: return lexer_handle_html_tag_close_state(lexer);
      case STATE_HTML_COMMENT_OPEN: return lexer_handle_html_comment_open_state(lexer);
      case STATE_HTML_COMMENT_CLOSE: return lexer_handle_html_comment_close_state(lexer);
      case STATE_ERB_OPEN: return lexer_handle_erb_open_state(lexer);
    }
  }

  return token_init("\0", TOKEN_EOF, lexer);
}

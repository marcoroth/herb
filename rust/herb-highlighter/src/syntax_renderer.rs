use std::sync::Arc;

use herb::Token;

use crate::color::{colorize, is_color_enabled, Color};
use crate::herb_backend::{Herb, HerbBackend};
use crate::ruby_keywords::RUBY_KEYWORDS;
use crate::themes::ColorScheme;

const HIGHLIGHTED_METHODS: &[&str] = &["raise"];

fn is_highlighted_word(word: &str) -> bool {
  RUBY_KEYWORDS.contains(&word) || HIGHLIGHTED_METHODS.contains(&word)
}

#[derive(Debug, Default)]
struct SyntaxRenderState {
  in_tag: bool,
  in_quotes: bool,
  quote_character: String,
  tag_name: String,
  is_closing_tag: bool,
  expecting_attribute_name: bool,
  expecting_attribute_value: bool,
  in_comment: bool,
  in_erb_comment: bool,
}

pub struct SyntaxRenderer {
  colors: ColorScheme,
  herb: Arc<dyn HerbBackend>,
}

impl SyntaxRenderer {
  pub fn new(colors: ColorScheme) -> Self {
    Self::with_backend(colors, Arc::new(Herb))
  }

  pub fn with_backend(colors: ColorScheme, herb: Arc<dyn HerbBackend>) -> Self {
    Self { colors, herb }
  }

  pub fn highlight(&self, content: &str) -> String {
    let tokens = match self.herb.lex(content) {
      Ok(tokens) => tokens,
      Err(_) => return content.to_string(),
    };

    self.highlight_tokens(&tokens, content)
  }

  fn apply_color(&self, text: &str, color: Option<Color>) -> String {
    match color {
      Some(color) if is_color_enabled() => colorize(text, color),
      _ => text.to_string(),
    }
  }

  fn highlight_ruby_code(&self, code: &str) -> String {
    if !is_color_enabled() {
      return code.to_string();
    }

    let mut highlighted = String::with_capacity(code.len());

    for word in split_ruby_words(code) {
      if is_highlighted_word(word) {
        highlighted.push_str(&self.apply_color(word, Some(self.colors.ruby_keyword)));
      } else {
        highlighted.push_str(word);
      }
    }

    highlighted
  }

  fn highlight_tokens(&self, tokens: &[Token], content: &str) -> String {
    if tokens.is_empty() {
      return content.to_string();
    }

    let mut highlighted = String::new();
    let mut last_end = 0;

    let mut state = SyntaxRenderState::default();

    for token in tokens {
      if token.range.from > last_end {
        highlighted.push_str(slice(content, last_end, token.range.from));
      }

      let token_text = slice(content, token.range.from, token.range.to);

      self.update_state(&mut state, token, token_text);

      let color = self.contextual_color(&state, token, token_text);

      if token.token_type == "TOKEN_ERB_CONTENT" {
        if state.in_erb_comment {
          highlighted.push_str(&self.apply_color(token_text, Some(self.colors.token_html_comment_start)));
        } else {
          highlighted.push_str(&self.highlight_ruby_code(token_text));
        }
      } else {
        highlighted.push_str(&self.apply_color(token_text, color));
      }

      if token.token_type == "TOKEN_ERB_END" && state.in_erb_comment {
        state.in_erb_comment = false;
      }

      last_end = token.range.to;
    }

    if last_end < content.len() {
      highlighted.push_str(slice(content, last_end, content.len()));
    }

    highlighted
  }

  fn update_state(&self, state: &mut SyntaxRenderState, token: &Token, token_text: &str) {
    match token.token_type.as_str() {
      "TOKEN_HTML_TAG_START" => {
        state.in_tag = true;
        state.is_closing_tag = false;
        state.expecting_attribute_name = false;
        state.expecting_attribute_value = false;
      }

      "TOKEN_HTML_TAG_START_CLOSE" => {
        state.in_tag = true;
        state.is_closing_tag = true;
        state.expecting_attribute_name = false;
        state.expecting_attribute_value = false;
      }

      "TOKEN_HTML_TAG_END" | "TOKEN_HTML_TAG_SELF_CLOSE" => {
        state.in_tag = false;
        state.tag_name = String::new();
        state.is_closing_tag = false;
        state.expecting_attribute_name = false;
        state.expecting_attribute_value = false;
      }

      "TOKEN_IDENTIFIER" => {
        if state.in_tag && state.tag_name.is_empty() {
          state.tag_name = token_text.to_string();
          state.expecting_attribute_name = !state.is_closing_tag;
        } else if state.in_tag && state.expecting_attribute_name {
          state.expecting_attribute_name = false;
          state.expecting_attribute_value = true;
        }
      }

      "TOKEN_EQUALS" => {
        if state.in_tag {
          state.expecting_attribute_value = true;
        }
      }

      "TOKEN_QUOTE" => {
        if state.in_tag {
          if !state.in_quotes {
            state.in_quotes = true;
            state.quote_character = token_text.to_string();
          } else if token_text == state.quote_character {
            state.in_quotes = false;
            state.quote_character = String::new();
            state.expecting_attribute_name = true;
            state.expecting_attribute_value = false;
          }
        }
      }

      "TOKEN_WHITESPACE" => {
        if state.in_tag && !state.in_quotes && !state.tag_name.is_empty() {
          state.expecting_attribute_name = true;
          state.expecting_attribute_value = false;
        }
      }

      "TOKEN_HTML_COMMENT_START" => state.in_comment = true,
      "TOKEN_HTML_COMMENT_END" => state.in_comment = false,

      "TOKEN_ERB_START" => state.in_erb_comment = token_text.starts_with("<%#"),

      _ => {}
    }
  }

  fn contextual_color(&self, state: &SyntaxRenderState, token: &Token, token_text: &str) -> Option<Color> {
    let token_type = token.token_type.as_str();

    if state.in_comment
      && token_type != "TOKEN_HTML_COMMENT_START"
      && token_type != "TOKEN_HTML_COMMENT_END"
      && token_type != "TOKEN_ERB_START"
      && token_type != "TOKEN_ERB_CONTENT"
      && token_type != "TOKEN_ERB_END"
    {
      return Some(self.colors.token_html_comment_start);
    }

    if state.in_erb_comment && token_type != "TOKEN_ERB_CONTENT" {
      return Some(self.colors.token_html_comment_start);
    }

    match token_type {
      "TOKEN_IDENTIFIER" if state.in_tag => {
        if token_text == state.tag_name {
          return Some(self.colors.token_html_tag_start);
        } else if (state.expecting_attribute_value && !state.in_quotes) || state.expecting_attribute_name {
          return Some(Color::Rgb(0xD1, 0x9A, 0x66));
        } else if state.in_quotes {
          return Some(Color::Rgb(0x98, 0xC3, 0x79));
        }
      }

      "TOKEN_QUOTE" if state.in_tag => return Some(Color::Rgb(0x98, 0xC3, 0x79)),

      _ => {}
    }

    self.colors.for_token_type(token_type)
  }
}

fn slice(content: &str, from: usize, to: usize) -> &str {
  content.get(from..to.min(content.len())).unwrap_or("")
}

fn split_ruby_words(code: &str) -> Vec<&str> {
  fn kind(character: char) -> u8 {
    if character.is_whitespace() {
      0
    } else if character.is_ascii_alphanumeric() || character == '_' {
      1
    } else {
      2
    }
  }

  let mut words = Vec::new();
  let mut start = 0;

  for (index, character) in code.char_indices() {
    if index > start && kind(character) != kind(code[start..].chars().next().unwrap()) {
      words.push(&code[start..index]);
      start = index;
    }
  }

  if start < code.len() {
    words.push(&code[start..]);
  }

  words
}

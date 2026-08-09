use std::sync::Arc;

use herb::Token;

use crate::color::{colorize, is_color_enabled, Color};
use crate::document::{StyleRole, StyledRun};
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
    self.resolve_runs(&self.highlight_runs(content))
  }

  pub fn highlight_runs(&self, content: &str) -> Vec<StyledRun> {
    let tokens = match self.herb.lex(content) {
      Ok(tokens) => tokens,
      Err(_) => {
        return vec![StyledRun {
          text: content.to_string(),
          role: StyleRole::Plain,
        }]
      }
    };

    self.runs_for_tokens(&tokens, content)
  }

  fn apply_color(&self, text: &str, color: Option<Color>) -> String {
    match color {
      Some(color) if is_color_enabled() => colorize(text, color),
      _ => text.to_string(),
    }
  }

  pub fn resolve_runs(&self, runs: &[StyledRun]) -> String {
    let mut resolved = String::new();

    for run in runs {
      resolved.push_str(&self.apply_color(&run.text, self.color_for_role(&run.role)));
    }

    resolved
  }

  fn color_for_role(&self, role: &StyleRole) -> Option<Color> {
    match role {
      StyleRole::Plain => None,
      StyleRole::Token(token_type) => self.colors.for_token_type(token_type),
      StyleRole::RubyKeyword => Some(self.colors.ruby_keyword),
      StyleRole::TagName => Some(self.colors.token_html_tag_start),
      StyleRole::AttributeName => Some(Color::Rgb(0xD1, 0x9A, 0x66)),
      StyleRole::AttributeValue => Some(Color::Rgb(0x98, 0xC3, 0x79)),
      StyleRole::CommentInterior => Some(self.colors.token_html_comment_start),
    }
  }

  fn runs_for_tokens(&self, tokens: &[Token], content: &str) -> Vec<StyledRun> {
    if content.is_empty() {
      return Vec::new();
    }

    if tokens.is_empty() {
      return vec![StyledRun {
        text: content.to_string(),
        role: StyleRole::Plain,
      }];
    }

    let mut runs = Vec::new();
    let mut last_end = 0;

    let mut state = SyntaxRenderState::default();

    for token in tokens {
      if token.range.from > last_end {
        runs.push(StyledRun {
          text: slice(content, last_end, token.range.from).to_string(),
          role: StyleRole::Plain,
        });
      }

      let token_text = slice(content, token.range.from, token.range.to);

      self.update_state(&mut state, token, token_text);

      if token.token_type == "TOKEN_ERB_CONTENT" {
        for word in split_ruby_words(token_text) {
          let role = if is_highlighted_word(word) {
            StyleRole::RubyKeyword
          } else {
            StyleRole::Plain
          };

          runs.push(StyledRun { text: word.to_string(), role });
        }
      } else {
        runs.push(StyledRun {
          text: token_text.to_string(),
          role: self.contextual_role(&state, token, token_text),
        });
      }

      last_end = token.range.to;
    }

    if last_end < content.len() {
      runs.push(StyledRun {
        text: slice(content, last_end, content.len()).to_string(),
        role: StyleRole::Plain,
      });
    }

    runs
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

      _ => {}
    }
  }

  fn contextual_role(&self, state: &SyntaxRenderState, token: &Token, token_text: &str) -> StyleRole {
    let token_type = token.token_type.as_str();

    if state.in_comment
      && token_type != "TOKEN_HTML_COMMENT_START"
      && token_type != "TOKEN_HTML_COMMENT_END"
      && token_type != "TOKEN_ERB_START"
      && token_type != "TOKEN_ERB_CONTENT"
      && token_type != "TOKEN_ERB_END"
    {
      return StyleRole::CommentInterior;
    }

    match token_type {
      "TOKEN_IDENTIFIER" if state.in_tag => {
        if token_text == state.tag_name {
          return StyleRole::TagName;
        } else if (state.expecting_attribute_value && !state.in_quotes) || state.expecting_attribute_name {
          return StyleRole::AttributeName;
        } else if state.in_quotes {
          return StyleRole::AttributeValue;
        }
      }

      "TOKEN_QUOTE" if state.in_tag => return StyleRole::AttributeValue,

      _ => {}
    }

    StyleRole::Token(token_type.to_string())
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

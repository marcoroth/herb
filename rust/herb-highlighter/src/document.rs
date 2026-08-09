#[derive(Debug, Clone, PartialEq)]
pub enum StyleRole {
  Plain,
  Token(String),
  RubyKeyword,
  TagName,
  AttributeName,
  AttributeValue,
  CommentInterior,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StyledRun {
  pub text: String,
  pub role: StyleRole,
}

mod buffer;
mod location;
mod range;
mod token;
mod util;

use crate::buffer::Buffer;
use crate::location::Location;
use crate::range::Range;

use crate::token::Token;
use crate::token::TokenType;

fn main() {
  let start_location = Location::new(1, 5);
  let end_location = Location::new(1, 10);
  let range = Range::new(5, 10);
  let token = Token::new(TokenType::Identifier, "example".to_string(), start_location, end_location, range);

  println!("{}", token.to_string());

  let mut buffer = Buffer::new();

  buffer.append("Hello,");
  buffer.append_char(' ');
  buffer.append("World!");

  println!("{}", buffer.value());
}

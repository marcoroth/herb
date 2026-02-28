use crate::bindings::{location_T, position_T, range_T, token_T};
use crate::{Location, Position, Range, Token};
use std::ffi::CStr;

impl From<position_T> for Position {
  fn from(c_position: position_T) -> Self {
    Position::new(c_position.line, c_position.column)
  }
}

impl From<range_T> for Range {
  fn from(c_range: range_T) -> Self {
    Range::new(c_range.from as usize, c_range.to as usize)
  }
}

impl From<location_T> for Location {
  fn from(c_location: location_T) -> Self {
    Location::new(c_location.start.into(), c_location.end.into())
  }
}

/// Converts a C token pointer to a Rust Token.
///
/// # Safety
///
/// The caller must ensure that `token_ptr` is a valid, non-null pointer to a `token_T`
/// and that the token's string fields (`value`, `token_type`) point to valid C strings.
pub unsafe fn token_from_c(token_ptr: *const token_T) -> Token {
  let token = &*token_ptr;

  let value = if token.value.is_null() {
    String::new()
  } else {
    CStr::from_ptr(token.value).to_string_lossy().into_owned()
  };

  let token_type = CStr::from_ptr(crate::ffi::token_type_to_string(token.type_)).to_string_lossy().into_owned();

  Token {
    token_type,
    value,
    range: token.range.into(),
    location: token.location.into(),
  }
}

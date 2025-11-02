use crate::ffi::{CLocation, CPosition, CRange, CToken};
use crate::{Location, Position, Range, Token};
use std::ffi::CStr;

impl From<CPosition> for Position {
  fn from(c_pos: CPosition) -> Self {
    Position::new(c_pos.line, c_pos.column)
  }
}

impl From<CRange> for Range {
  fn from(c_range: CRange) -> Self {
    Range::new(c_range.from as usize, c_range.to as usize)
  }
}

impl From<CLocation> for Location {
  fn from(c_loc: CLocation) -> Self {
    Location::new(c_loc.start.into(), c_loc.end.into())
  }
}

/// Converts a C token pointer to a Rust Token.
///
/// # Safety
///
/// The caller must ensure that `c_token` is a valid, non-null pointer to a `CToken`
/// and that the token's string fields (`value`, `token_type`) point to valid C strings.
pub unsafe fn token_from_c(c_token: *const CToken) -> Token {
  let token = &*c_token;

  let value = if token.value.is_null() {
    String::new()
  } else {
    CStr::from_ptr(token.value).to_string_lossy().into_owned()
  };

  let token_type = CStr::from_ptr(crate::ffi::token_type_to_string(token.type_))
    .to_string_lossy()
    .into_owned();

  Token {
    token_type,
    value,
    range: token.range.into(),
    location: token.location.into(),
  }
}

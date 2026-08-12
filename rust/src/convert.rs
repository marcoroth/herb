use crate::bindings::{hb_string_T, location_T, position_T, range_T, token_T};
use crate::{Location, Position, Range, Token};

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

/// Converts an `hb_string_T` to a Rust `String`.
///
/// # Safety
///
/// The caller must ensure that `hb_string.data` points to valid memory of at least
/// `hb_string.length` bytes, or is null.
pub unsafe fn string_from_hb_string(hb_string: hb_string_T) -> String {
  if hb_string.data.is_null() || hb_string.length == 0 {
    String::new()
  } else {
    let slice = std::slice::from_raw_parts(hb_string.data as *const u8, hb_string.length as usize);
    String::from_utf8_lossy(slice).into_owned()
  }
}

/// Converts a C token pointer to a Rust Token.
///
/// # Safety
///
/// The caller must ensure that `token_ptr` is a valid, non-null pointer to a `token_T`
/// and that the token's string fields point to valid memory.
pub unsafe fn token_from_c(token_ptr: *const token_T) -> Token {
  let token = &*token_ptr;

  let value = string_from_hb_string(token.value);
  let token_type = string_from_hb_string(crate::ffi::token_type_to_string(token.type_));

  Token {
    token_type,
    value,
    range: token.range.into(),
    location: token.location.into(),
  }
}

pub mod aria;
pub mod global_attributes;
pub mod queries;
pub mod registry;
pub mod svg;
pub mod types;

pub use queries::HtmlSchema;
pub use registry::HTML_ELEMENTS;
pub use types::{ContentModel, ElementCategory, ElementDef, ElementScope};

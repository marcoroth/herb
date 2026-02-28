pub mod diff;
pub mod display;
pub mod explain;
pub mod html_schema;
pub mod infer;
pub mod shape;
pub mod simplify;
pub mod validate;

pub use diff::{diff_shapes, DiffKind, DiffResult, ShapeDifference};
pub use explain::{explain, explain_difference};
pub use html_schema::{ContentModel, ElementCategory, ElementDef, ElementScope, HtmlSchema, HTML_ELEMENTS};
pub use infer::{infer_shape, infer_shape_raw};
pub use shape::{AttributeValue, ElementShape, Shape, ShapeAttribute, TagName};
pub use simplify::simplify;
pub use validate::{validate, Diagnostic, DiagnosticSeverity};

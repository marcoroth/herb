pub mod ansi;
pub mod color;
pub mod diagnostic;
pub mod diagnostic_markers;
pub mod diagnostic_renderer;
pub mod diff_computer;
pub mod diff_renderer;
pub mod document;
pub mod error;
pub mod file_renderer;
pub mod gutter;
pub mod herb_backend;
pub mod highlighter;
pub mod inline_diagnostic_renderer;
pub mod line_wrapper;
pub mod ruby_keywords;
pub mod syntax_renderer;
pub mod text_formatter;
pub mod themes;
pub mod unified_diff;
pub mod util;

pub use ansi::{ansi_sequence_at_start, find_ansi_sequences, split_capturing_ansi, strip_ansi, visible_width, ANSI_ESCAPE};
pub use color::{colorize, colorize_with_background, hyperlink, severity_color, Color, NamedColor};
pub use diagnostic::{Diagnostic, DiagnosticSeverity, DiagnosticTag, SerializedLocation, SerializedPosition, DIAGNOSTIC_SEVERITIES};
pub use diagnostic_markers::{compute_diagnostic_markers, DiagnosticMarker};
pub use diagnostic_renderer::{DiagnosticRenderOptions, DiagnosticRenderer};
pub use diff_computer::{compute_diff_hunks, compute_inline_ranges, DiffHunk, DiffLine, DiffLineType, InlineRange, InlineRanges};
pub use diff_renderer::{DiffLayout, DiffRenderOptions, DiffRenderer, RemovedLineStyle, SingleLineStyle};
pub use document::{StyleRole, StyledRun};
pub use error::HighlightError;
pub use file_renderer::FileRenderer;
pub use gutter::{GUTTER_WIDTH, MIN_CONTENT_WIDTH};
pub use herb_backend::{Herb, HerbBackend};
pub use highlighter::{highlight_content, highlight_file, FileUrlBuilder, HighlightDiagnosticOptions, HighlightOptions, Highlighter, SuffixBuilder};
pub use inline_diagnostic_renderer::{CodeUrlBuilder, InlineDiagnosticRenderer};
pub use line_wrapper::LineWrapper;
pub use ruby_keywords::{is_ruby_keyword, RUBY_KEYWORDS};
pub use syntax_renderer::SyntaxRenderer;
pub use text_formatter::TextFormatter;
pub use themes::{
  get_default_theme, get_theme, get_theme_names, is_custom_theme, is_valid_theme, load_custom_theme, resolve_theme, ColorScheme, Theme, DEFAULT_THEME,
  OPTIONAL_COLOR_SCHEME_KEYS, REQUIRED_COLOR_SCHEME_KEYS, THEME_NAMES,
};
pub use unified_diff::{parse_unified_diff, ParsedFile};
pub use util::{apply_background, dim_styled_text, slice_styled, BackgroundOptions, BackgroundRange};

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

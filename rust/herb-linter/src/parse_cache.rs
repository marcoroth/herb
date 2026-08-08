use herb::{ParseResult, ParserOptions};

/// Caches one parse per distinct set of parser options, so rules asking for the
/// same options share a single parse of the source.
pub struct ParseCache<'source> {
  source: &'source str,
  entries: Vec<(ParserOptions, Option<ParseResult>)>,
}

impl<'source> ParseCache<'source> {
  pub fn new(source: &'source str) -> Self {
    Self { source, entries: Vec::new() }
  }

  pub fn get(&mut self, options: &ParserOptions) -> Option<&ParseResult> {
    let index = match self.entries.iter().position(|(cached, _)| cached == options) {
      Some(index) => index,

      None => {
        let result = herb::parse_with_options(self.source, options).ok();
        self.entries.push((options.clone(), result));
        self.entries.len() - 1
      }
    };

    self.entries[index].1.as_ref()
  }
}

use herb::location::Location;

#[derive(Debug, Clone, PartialEq)]
pub struct Local {
  pub name: String,
  pub declaration: Location,
  pub usages: Vec<Location>,
}

impl Local {
  pub fn new(name: impl Into<String>, declaration: Location, usages: Vec<Location>) -> Self {
    Self {
      name: name.into(),
      declaration,
      usages,
    }
  }

  pub fn locations(&self) -> Vec<Location> {
    std::iter::once(self.declaration).chain(self.usages.iter().copied()).collect()
  }
}

use std::fmt;
use std::path::{Path, PathBuf};

use crate::position::Position;

const FILE_SCHEME_SEPARATOR: &str = "://file";

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SourcePath {
  pub path: PathBuf,
  pub project_path: Option<PathBuf>,
  pub line: Option<u32>,
  pub column: Option<u32>,
  pub scheme: Option<String>,
}

impl SourcePath {
  pub fn new<P: AsRef<Path>>(path: P) -> Self {
    Self {
      path: path.as_ref().to_path_buf(),
      project_path: None,
      line: None,
      column: None,
      scheme: None,
    }
  }

  pub fn at<P: AsRef<Path>>(path: P, position: Option<Position>) -> Self {
    Self::new(path).with_position(position)
  }

  pub fn parse(string: &str) -> Option<Self> {
    let (scheme, rest) = match string.find(FILE_SCHEME_SEPARATOR) {
      Some(index) if is_scheme(&string[..index]) && string[index + FILE_SCHEME_SEPARATOR.len()..].starts_with('/') => {
        (Some(string[..index].to_string()), &string[index + FILE_SCHEME_SEPARATOR.len()..])
      }
      _ => (None, string),
    };

    let (rest, column) = split_trailing_number(rest);
    let (path, line) = if column.is_some() { split_trailing_number(rest) } else { (rest, None) };

    let (path, line, column) = match (line, column) {
      (Some(line), column) => (path, Some(line), column),
      (None, Some(line)) => (path, Some(line), None),
      (None, None) => (path, None, None),
    };

    if path.is_empty() {
      return None;
    }

    Some(Self {
      path: PathBuf::from(path),
      project_path: None,
      line,
      column: column.map(|column| column.saturating_sub(1)),
      scheme,
    })
  }

  pub fn with_project_path<P: AsRef<Path>>(&self, project_path: Option<P>) -> Self {
    Self {
      project_path: project_path.map(|path| path.as_ref().to_path_buf()),
      ..self.clone()
    }
  }

  pub fn is_absolute(&self) -> bool {
    self.path.is_absolute()
  }

  pub fn absolute_path(&self) -> PathBuf {
    if self.path.is_absolute() {
      return self.path.clone();
    }

    match &self.project_path {
      None => self.path.clone(),
      Some(project) => project.join(&self.path),
    }
  }

  pub fn relative_path(&self) -> PathBuf {
    match &self.project_path {
      None => self.path.clone(),
      Some(project) => relative_from(&self.absolute_path(), project),
    }
  }

  pub fn absolute(&self) -> Self {
    self.with_path(self.absolute_path())
  }

  pub fn relative(&self) -> Self {
    self.with_path(self.relative_path())
  }

  pub fn position(&self) -> Option<Position> {
    self.line.map(|line| Position::new(line, self.column.unwrap_or(0)))
  }

  pub fn has_position(&self) -> bool {
    self.line.is_some()
  }

  pub fn with_path<P: AsRef<Path>>(&self, path: P) -> Self {
    Self {
      path: path.as_ref().to_path_buf(),
      ..self.clone()
    }
  }

  pub fn with_position(&self, position: Option<Position>) -> Self {
    Self {
      line: position.map(|position| position.line),
      column: position.map(|position| position.column),
      ..self.clone()
    }
  }

  pub fn with_scheme(&self, scheme: Option<&str>) -> Self {
    Self {
      scheme: scheme.map(str::to_string),
      ..self.clone()
    }
  }
}

impl fmt::Display for SourcePath {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    if let Some(scheme) = &self.scheme {
      write!(f, "{scheme}{FILE_SCHEME_SEPARATOR}")?;
    }

    if self.scheme.is_some() && !self.path.is_absolute() {
      write!(f, "/")?;
    }

    write!(f, "{}", self.path.display())?;

    match (self.line, self.column) {
      (Some(line), Some(column)) => write!(f, ":{line}:{}", column + 1),
      (Some(line), None) => write!(f, ":{line}"),
      (None, _) => Ok(()),
    }
  }
}

fn is_scheme(candidate: &str) -> bool {
  !candidate.is_empty()
    && candidate.starts_with(|character: char| character.is_ascii_alphabetic())
    && candidate
      .chars()
      .all(|character| character.is_ascii_alphanumeric() || matches!(character, '+' | '.' | '-'))
}

fn relative_from(path: &Path, project: &Path) -> PathBuf {
  use std::path::Component;

  if path.is_absolute() != project.is_absolute() {
    return path.to_path_buf();
  }

  let keep = |component: &Component| !matches!(component, Component::CurDir);
  let from: Vec<Component> = project.components().filter(keep).collect();
  let to: Vec<Component> = path.components().filter(keep).collect();
  let shared = from.iter().zip(to.iter()).take_while(|(a, b)| a == b).count();

  if path.is_absolute() && shared == 0 {
    return path.to_path_buf();
  }

  let mut walk = PathBuf::new();

  for _ in shared..from.len() {
    walk.push("..");
  }

  for component in &to[shared..] {
    walk.push(component.as_os_str());
  }

  if walk.as_os_str().is_empty() {
    PathBuf::from(".")
  } else {
    walk
  }
}

fn split_trailing_number(string: &str) -> (&str, Option<u32>) {
  match string.rfind(':') {
    Some(index) => {
      let tail = &string[index + 1..];

      match tail.parse::<u32>() {
        Ok(number) if !tail.is_empty() => (&string[..index], Some(number)),
        _ => (string, None),
      }
    }

    None => (string, None),
  }
}

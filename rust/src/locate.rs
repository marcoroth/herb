use std::collections::HashMap;

use crate::location::Location;
use crate::nodes::Node;
use crate::parse_result::ParseResult;
use crate::position::Position;

pub trait LocateSource {
  fn locate_root(&self) -> &dyn Node;
}

impl<T: Node> LocateSource for T {
  fn locate_root(&self) -> &dyn Node {
    self
  }
}

impl LocateSource for dyn Node {
  fn locate_root(&self) -> &dyn Node {
    self
  }
}

impl LocateSource for ParseResult {
  fn locate_root(&self) -> &dyn Node {
    &self.value
  }
}

pub struct LocateResult<'a> {
  pub node: &'a dyn Node,
  pub ancestors: Vec<&'a dyn Node>,
}

impl<'a> LocateResult<'a> {
  pub fn innermost<F>(&self, predicate: F) -> Option<&'a dyn Node>
  where
    F: Fn(&dyn Node) -> bool,
  {
    if predicate(self.node) {
      return Some(self.node);
    }

    self.ancestors.iter().find(|node| predicate(**node)).copied()
  }

  pub fn path(&self) -> Vec<&'a dyn Node> {
    let mut path: Vec<&'a dyn Node> = self.ancestors.iter().rev().copied().collect();

    path.push(self.node);
    path
  }
}

fn contains(node: &dyn Node, position: Position) -> bool {
  let location = node.location();

  !location.is_empty() && location.contains(position)
}

fn union(first: Option<Location>, second: Location) -> Location {
  match first {
    None => second,
    Some(first) => Location::new(first.start.min(second.start), first.end.max(second.end)),
  }
}

fn extent(node: &dyn Node, extents: &mut HashMap<*const (), Option<Location>>) -> Option<Location> {
  let key = node as *const dyn Node as *const ();

  if let Some(cached) = extents.get(&key) {
    return *cached;
  }

  extents.insert(key, None);

  let own = if node.location().is_empty() { None } else { Some(*node.location()) };

  let found = node
    .child_nodes()
    .into_iter()
    .filter_map(|child| extent(child, extents))
    .fold(own, |accumulator, child| Some(union(accumulator, child)));

  extents.insert(key, found);

  found
}

fn within_extent(node: &dyn Node, position: Position, extents: &mut HashMap<*const (), Option<Location>>) -> bool {
  extent(node, extents).is_some_and(|found| found.contains(position))
}

pub fn locatable<S: LocateSource + ?Sized>(source: &S, position: Position) -> bool {
  within_extent(source.locate_root(), position, &mut HashMap::new())
}

pub fn locate<S: LocateSource + ?Sized>(source: &S, position: Position) -> Option<LocateResult<'_>> {
  let mut extents: HashMap<*const (), Option<Location>> = HashMap::new();
  let start = source.locate_root();

  if !within_extent(start, position, &mut extents) {
    return None;
  }

  let mut current = start;
  let mut ancestors: Vec<&dyn Node> = Vec::new();

  loop {
    let child = current
      .child_nodes()
      .into_iter()
      .find(|candidate| within_extent(*candidate, position, &mut extents));

    match child {
      Some(child) => {
        ancestors.insert(0, current);
        current = child;
      }
      None => {
        if contains(current, position) {
          return Some(LocateResult { node: current, ancestors });
        }

        let nearest = ancestors.iter().position(|ancestor| contains(*ancestor, position))?;
        let node = ancestors[nearest];

        return Some(LocateResult {
          node,
          ancestors: ancestors.split_off(nearest + 1),
        });
      }
    }
  }
}

use std::collections::HashSet;
use std::sync::LazyLock;

pub static BOOLEAN_ATTRIBUTES: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "allowfullscreen",
    "async",
    "autofocus",
    "autoplay",
    "checked",
    "compact",
    "controls",
    "declare",
    "default",
    "defer",
    "disabled",
    "formnovalidate",
    "hidden",
    "itemscope",
    "loop",
    "multiple",
    "muted",
    "nohref",
    "noresize",
    "noshade",
    "novalidate",
    "nowrap",
    "open",
    "readonly",
    "required",
    "reversed",
    "scoped",
    "seamless",
    "selected",
    "sortable",
    "truespeed",
    "typemustmatch",
  ]
  .into_iter()
  .collect()
});

use std::env;
use std::path::PathBuf;

fn main() {
  let crate_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
  let header_path = PathBuf::from(&crate_dir).join("../ext/herb_highlighter/include/herb_highlighter.h");

  if let Ok(bindings) = cbindgen::generate(&crate_dir) {
    if let Some(parent) = header_path.parent() {
      let _ = std::fs::create_dir_all(parent);
    }

    bindings.write_to_file(&header_path);
  }
}

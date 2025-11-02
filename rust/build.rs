use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
  let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
  let root_dir = manifest_dir.parent().unwrap();
  let src_dir = root_dir.join("src");
  let prism_path = get_prism_path(root_dir);
  let prism_include = prism_path.join("include");
  let prism_build = prism_path.join("build");

  println!("cargo:rustc-link-search=native={}", prism_build.display());
  println!("cargo:rustc-link-lib=static=prism");

  let mut c_sources = Vec::new();

  for path in glob::glob(src_dir.join("**/*.c").to_str().unwrap())
    .unwrap()
    .flatten()
  {
    if !path.ends_with("main.c") {
      c_sources.push(path);
    }
  }

  let mut build = cc::Build::new();
  build
    .flag("-std=c99")
    .flag("-Wall")
    .flag("-Wextra")
    .flag("-Wno-unused-parameter")
    .flag("-fPIC")
    .opt_level(2)
    .include(src_dir.join("include"))
    .include(prism_include)
    .files(&c_sources);

  build.compile("herb");

  for source in &c_sources {
    println!("cargo:rerun-if-changed={}", source.display());
  }

  println!("cargo:rerun-if-changed=build.rs");
}

fn get_prism_path(root_dir: &Path) -> PathBuf {
  let output = Command::new("bundle")
    .args(["show", "prism"])
    .current_dir(root_dir)
    .output()
    .expect("Failed to run `bundle show prism`");

  let output_str = String::from_utf8(output.stdout).expect("Failed to parse bundle output");

  let path_str = output_str
    .lines()
    .last()
    .expect("No output from bundle show prism")
    .trim()
    .to_string();

  PathBuf::from(path_str)
}

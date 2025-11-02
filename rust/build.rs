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
    .include(&prism_include)
    .files(&c_sources);

  build.compile("herb");

  let bindings = bindgen::Builder::default()
    .header(src_dir.join("include/herb.h").to_str().unwrap())
    .header(src_dir.join("include/ast_nodes.h").to_str().unwrap())
    .header(src_dir.join("include/errors.h").to_str().unwrap())
    .header(src_dir.join("include/element_source.h").to_str().unwrap())
    .header(src_dir.join("include/token_struct.h").to_str().unwrap())
    .header(src_dir.join("include/util/hb_string.h").to_str().unwrap())
    .header(src_dir.join("include/util/hb_array.h").to_str().unwrap())
    .clang_arg(format!("-I{}", src_dir.join("include").display()))
    .clang_arg(format!("-I{}", prism_include.display()))
    .allowlist_function("herb_.*")
    .allowlist_function("hb_array_.*")
    .allowlist_function("token_type_to_string")
    .allowlist_function("ast_node_free")
    .allowlist_function("element_source_to_string")
    .allowlist_type("AST_.*")
    .allowlist_type("ERROR_.*")
    .allowlist_type(".*_ERROR_T")
    .allowlist_type("element_source_t")
    .allowlist_type("ast_node_type_T")
    .allowlist_type("error_type_T")
    .allowlist_type("hb_array_T")
    .allowlist_type("hb_string_T")
    .allowlist_type("token_T")
    .allowlist_type("position_T")
    .allowlist_type("location_T")
    .allowlist_type("herb_extract_language_T")
    .allowlist_var("AST_.*")
    .allowlist_var("ERROR_.*")
    .allowlist_var("ELEMENT_SOURCE_.*")
    .allowlist_var("HERB_EXTRACT_.*")
    .derive_debug(true)
    .derive_default(false)
    .prepend_enum_name(false)
    .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
    .generate()
    .expect("Unable to generate bindings");

  let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
  bindings
    .write_to_file(out_path.join("bindings.rs"))
    .expect("Couldn't write bindings!");

  for source in &c_sources {
    println!("cargo:rerun-if-changed={}", source.display());
  }

  println!(
    "cargo:rerun-if-changed={}",
    src_dir.join("include").display()
  );
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

use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
  let target = env::var("TARGET").unwrap_or_default();
  let is_wasm = target.contains("wasm32") || target.contains("emscripten");

  let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
  let vendor_src_dir = manifest_dir.join("vendor/libherb/src");
  let vendor_include_dir = manifest_dir.join("vendor/libherb/src/include");

  let (src_dir, include_dir, root_dir) = if vendor_src_dir.exists() {
    (vendor_src_dir, vendor_include_dir, manifest_dir.clone())
  } else {
    let root = manifest_dir.parent().unwrap();
    (root.join("src"), root.join("src/include"), root.to_path_buf())
  };

  let prism_include = if is_wasm {
    let vendor_prism_include = manifest_dir.join("vendor/prism/include");

    if vendor_prism_include.exists() {
      vendor_prism_include
    } else {
      let prism_path = get_prism_path(&root_dir);
      prism_path.join("include")
    }
  } else {
    let vendor_prism_src = manifest_dir.join("vendor/prism/src");
    let vendor_prism_include = manifest_dir.join("vendor/prism/include");

    let prism_include = if vendor_prism_src.exists() {
      let mut prism_sources = Vec::new();
      for path in glob::glob(vendor_prism_src.join("**/*.c").to_str().unwrap()).unwrap().flatten() {
        prism_sources.push(path);
      }

      let mut prism_build = cc::Build::new();
      prism_build
        .flag("-std=c99")
        .flag("-fPIC")
        .opt_level(2)
        .define("HERB_EXCLUDE_PRETTYPRINT", None)
        .define("PRISM_EXCLUDE_PRETTYPRINT", None)
        .define("PRISM_EXCLUDE_JSON", None)
        .define("PRISM_EXCLUDE_PACK", None)
        .include(&vendor_prism_include)
        .files(&prism_sources)
        .warnings(false);

      prism_build.compile("prism");

      vendor_prism_include
    } else {
      let prism_path = get_prism_path(&root_dir);
      let prism_build = prism_path.join("build");
      println!("cargo:rustc-link-search=native={}", prism_build.display());
      println!("cargo:rustc-link-lib=static=prism");
      prism_path.join("include")
    };

    let mut c_sources = Vec::new();

    for path in glob::glob(src_dir.join("**/*.c").to_str().unwrap()).unwrap().flatten() {
      if !path.ends_with("main.c") {
        c_sources.push(path);
      }
    }

    let mut build = cc::Build::new();
    build
      .flag("-std=gnu99")
      .flag("-Wall")
      .flag("-Wextra")
      .flag("-Wno-unused-parameter")
      .flag("-fPIC")
      .opt_level(2)
      .define("HERB_EXCLUDE_PRETTYPRINT", None)
      .define("PRISM_EXCLUDE_JSON", None)
      .define("PRISM_EXCLUDE_PACK", None)
      .define("PRISM_EXCLUDE_SERIALIZATION", None)
      .include(&include_dir)
      .include(&prism_include)
      .files(&c_sources);

    build.compile("herb");

    for source in &c_sources {
      println!("cargo:rerun-if-changed={}", source.display());
    }

    prism_include
  };

  let mut builder = bindgen::Builder::default()
    .header(include_dir.join("analyze/analyze.h").to_str().unwrap())
    .header(include_dir.join("herb.h").to_str().unwrap())
    .header(include_dir.join("ast/ast_nodes.h").to_str().unwrap())
    .header(include_dir.join("errors.h").to_str().unwrap())
    .header(include_dir.join("extract.h").to_str().unwrap())
    .header(include_dir.join("lexer/token_struct.h").to_str().unwrap())
    .header(include_dir.join("lib/hb_allocator.h").to_str().unwrap())
    .header(include_dir.join("lib/hb_string.h").to_str().unwrap())
    .header(include_dir.join("lib/hb_array.h").to_str().unwrap())
    .header(include_dir.join("lib/hb_buffer.h").to_str().unwrap())
    .clang_arg(format!("-I{}", include_dir.display()))
    .clang_arg(format!("-I{}", prism_include.display()))
    .allowlist_function("herb_.*")
    .allowlist_function("hb_allocator_.*")
    .allowlist_function("hb_array_.*")
    .allowlist_function("hb_buffer_.*")
    .allowlist_function("token_type_to_string")
    .allowlist_function("ast_node_free")
    .allowlist_type("AST_.*")
    .allowlist_type("ERROR_.*")
    .allowlist_type(".*_ERROR_T")
    .allowlist_type("ast_node_type_T")
    .allowlist_type("error_type_T")
    .allowlist_type("hb_allocator")
    .allowlist_type("hb_allocator_T")
    .allowlist_type("hb_array_T")
    .allowlist_type("hb_buffer_T")
    .allowlist_type("hb_string_T")
    .allowlist_type("token_T")
    .allowlist_type("position_T")
    .allowlist_type("location_T")
    .allowlist_type("herb_extract_language_T")
    .allowlist_type("herb_extract_ruby_options_T")
    .allowlist_type("parser_options_T")
    .allowlist_type("prism_serialized_T")
    .allowlist_type("herb_prism_node_T")
    .allowlist_type("pm_buffer_t")
    .allowlist_type("pm_node_t")
    .allowlist_type("pm_node_type")
    .allowlist_type("pm_node_list_t")
    .allowlist_type("pm_location_t")
    .allowlist_type("pm_constant_id_t")
    .allowlist_type("pm_constant_pool_t")
    .allowlist_type("pm_parser_t")
    .allowlist_type("pm_.*_node_t")
    .allowlist_function("pm_prettyprint")
    .allowlist_function("pm_buffer_free")
    .allowlist_function("pm_constant_pool_id_to_constant")
    .allowlist_function("pm_visit_child_nodes")
    .allowlist_function("pm_node_type_to_str")
    .allowlist_var("PM_.*_NODE")
    .allowlist_var("AST_.*")
    .allowlist_var("ERROR_.*")
    .allowlist_var("ELEMENT_SOURCE_.*")
    .allowlist_var("HB_ALLOCATOR_.*")
    .allowlist_var("HERB_EXTRACT_.*")
    .derive_debug(true)
    .derive_default(false)
    .prepend_enum_name(false)
    .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()));

  if is_wasm {
    let host = env::var("HOST").unwrap_or_default();

    if !host.is_empty() {
      builder = builder.clang_arg(format!("--target={}", host));
    }

    builder = builder.layout_tests(false);
  }

  let bindings = builder.generate().expect("Unable to generate bindings");
  let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());

  bindings.write_to_file(out_path.join("bindings.rs")).expect("Couldn't write bindings!");

  generate_prism_name_fields(&prism_include, &out_path);

  println!("cargo:rerun-if-changed={}", include_dir.display());
  println!("cargo:rerun-if-changed=build.rs");
}

fn generate_prism_name_fields(prism_include: &Path, out_path: &Path) {
  let config_path = prism_include.parent().map(|root| root.join("config.yml")).filter(|path| path.exists());

  let mut arms = String::new();

  if let Some(config_path) = config_path {
    println!("cargo:rerun-if-changed={}", config_path.display());

    let config: serde_yaml::Value =
      serde_yaml::from_str(&std::fs::read_to_string(&config_path).expect("failed to read prism config.yml")).expect("failed to parse prism config.yml");

    if let Some(nodes) = config.get("nodes").and_then(|nodes| nodes.as_sequence()) {
      for node in nodes {
        let node_name = match node.get("name").and_then(|name| name.as_str()) {
          Some(name) => name,
          None => continue,
        };

        let has_constant_name = node
          .get("fields")
          .and_then(|fields| fields.as_sequence())
          .map(|fields| {
            fields.iter().any(|field| {
              let is_name = field.get("name").and_then(|name| name.as_str()) == Some("name");
              let field_type = field.get("type").and_then(|field_type| field_type.as_str()).unwrap_or("");

              is_name && (field_type == "constant" || field_type == "constant?")
            })
          })
          .unwrap_or(false);

        if !has_constant_name {
          continue;
        }

        let screaming = screaming_snake_case(node_name);
        let snake = screaming.to_lowercase();

        arms.push_str(&format!("    PM_{screaming} => (*(node as *const pm_{snake}_t)).name,\n"));
      }
    }
  }

  let function = format!(
    "unsafe fn node_name(node: *const pm_node_t, parser: *const pm_parser_t) -> Option<String> {{\n  \
       let id = match (*node).type_ as u32 {{\n{arms}    _ => return None,\n  }};\n\n  \
       constant_name(parser, id)\n}}\n"
  );

  std::fs::write(out_path.join("prism_name_fields.rs"), function).expect("failed to write prism_name_fields.rs");
}

fn screaming_snake_case(name: &str) -> String {
  let mut result = String::new();

  for (index, character) in name.char_indices() {
    if character.is_uppercase() && index > 0 {
      result.push('_');
    }

    result.push(character.to_ascii_uppercase());
  }

  result
}

fn get_prism_path(root_dir: &Path) -> PathBuf {
  let output = Command::new("bundle")
    .args(["show", "prism"])
    .current_dir(root_dir)
    .output()
    .expect("Failed to run `bundle show prism`");

  let output_string = String::from_utf8(output.stdout).expect("Failed to parse bundle output");

  let path_string = output_string.lines().last().expect("No output from bundle show prism").trim().to_string();

  PathBuf::from(path_string)
}

use herb_shape::{diff_shapes, explain, infer_shape, infer_shape_raw, validate};

fn main() {
  let arguments: Vec<String> = std::env::args().collect();

  let mut files: Vec<String> = Vec::new();
  let mut json = false;
  let mut raw = false;
  let mut explain_mode = false;
  let mut mode = Mode::Infer;

  let mut index = 1;

  while index < arguments.len() {
    match arguments[index].as_str() {
      "-h" | "--help" => {
        print_usage();

        return;
      }

      "-v" | "--version" => {
        println!("herb-shape {}", herb::VERSION);

        return;
      }

      "--json" => json = true,
      "--raw" => raw = true,
      "--explain" => explain_mode = true,
      "--validate" => mode = Mode::Validate,
      "--diff" => mode = Mode::Diff,

      argument if argument.starts_with('-') => {
        eprintln!("Unknown option: {}", argument);
        print_usage();
        std::process::exit(1);
      }

      _ => files.push(arguments[index].clone()),
    }

    index += 1;
  }

  match mode {
    Mode::Infer => run_infer(&files, json, raw),
    Mode::Validate => run_validate(&files, json, raw),
    Mode::Diff => run_diff(&files, json, raw, explain_mode),
  }
}

#[derive(Clone, Copy)]
enum Mode {
  Infer,
  Validate,
  Diff,
}

fn parse_file(file_path: &str) -> herb::ParseResult {
  let source = match std::fs::read_to_string(file_path) {
    Ok(content) => content,

    Err(error) => {
      eprintln!("Error reading file '{}': {}", file_path, error);
      std::process::exit(1);
    }
  };

  match herb::parse(&source) {
    Ok(result) => result,

    Err(error) => {
      eprintln!("Parse error in '{}': {}", file_path, error);
      std::process::exit(1);
    }
  }
}

fn infer_file(file_path: &str, raw: bool) -> herb_shape::Shape {
  let parse_result = parse_file(file_path);

  if raw {
    infer_shape_raw(&parse_result)
  } else {
    infer_shape(&parse_result)
  }
}

fn run_infer(files: &[String], json: bool, raw: bool) {
  if files.is_empty() {
    eprintln!("Error: no files specified");
    print_usage();
    std::process::exit(1);
  }

  let multiple = files.len() > 1;

  for file_path in files {
    let shape = infer_file(file_path, raw);

    if json {
      let output = if multiple {
        serde_json::json!({
          "file": file_path,
          "shape": shape,
        })
      } else {
        serde_json::to_value(&shape).unwrap()
      };

      println!("{}", serde_json::to_string_pretty(&output).unwrap());
    } else if multiple {
      println!("{}:", file_path);
      println!("  {}", shape);
      println!();
    } else {
      println!("{}", shape);
    }
  }
}

fn run_validate(files: &[String], json: bool, raw: bool) {
  if files.is_empty() {
    eprintln!("Error: no files specified");
    print_usage();
    std::process::exit(1);
  }

  let mut has_errors = false;

  for file_path in files {
    let shape = infer_file(file_path, raw);
    let diagnostics = validate(&shape);

    if !diagnostics.is_empty() {
      has_errors = true;
    }

    if json {
      let output = serde_json::json!({
        "file": file_path,
        "diagnostics": diagnostics,
      });

      println!("{}", serde_json::to_string_pretty(&output).unwrap());
    } else if diagnostics.is_empty() {
      println!("{}: ok", file_path);
    } else {
      println!("{}:", file_path);

      for diagnostic in &diagnostics {
        println!("  {}", diagnostic);
      }

      println!();
    }
  }

  if has_errors {
    std::process::exit(1);
  }
}

fn run_diff(files: &[String], json: bool, raw: bool, explain_mode: bool) {
  if files.len() != 2 {
    eprintln!("Error: --diff requires exactly 2 files");
    print_usage();
    std::process::exit(1);
  }

  let left = infer_file(&files[0], raw);
  let right = infer_file(&files[1], raw);
  let result = diff_shapes(&left, &right);

  if json {
    let mut output = serde_json::json!({
      "left": files[0],
      "right": files[1],
      "identical": result.is_identical(),
      "differences": result.differences,
    });

    if explain_mode {
      let explanations: Vec<String> = result.differences.iter().map(herb_shape::explain_difference).collect();
      output["explanation"] = serde_json::to_value(explanations).unwrap();
    }

    println!("{}", serde_json::to_string_pretty(&output).unwrap());
  } else {
    println!("--- {}", files[0]);
    println!("+++ {}", files[1]);
    println!();

    if result.is_identical() {
      if explain_mode {
        println!("{}", explain(&result));
      } else {
        println!("Shapes are identical.");
      }
    } else if explain_mode {
      println!("{}", explain(&result));
    } else {
      println!("{} difference(s) found:", result.differences.len());
      println!();

      for difference in &result.differences {
        println!("{}", difference);
      }
    }
  }

  if !result.is_identical() {
    std::process::exit(1);
  }
}

fn print_usage() {
  println!("Usage: herb-shape [options] <file> [file...]");
  println!();
  println!("Infer the structural shape of HTML+ERB templates.");
  println!();
  println!("Modes:");
  println!("  (default)        Infer and display the shape of each file");
  println!("  --validate       Check shapes against the HTML element schema");
  println!("  --diff           Compare the shapes of exactly 2 files");
  println!();
  println!("Options:");
  println!("  -h, --help       Show this help message");
  println!("  -v, --version    Show version");
  println!("  --json           Output as JSON");
  println!("  --raw            Skip simplification (show raw inferred shape)");
  println!("  --explain        Natural-language explanation of differences (with --diff)");
}

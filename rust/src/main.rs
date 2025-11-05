fn main() {
  let args: Vec<String> = std::env::args().collect();

  if args.len() < 2 {
    print_usage();
    std::process::exit(1);
  }

  let command = &args[1];

  match command.as_str() {
    "version" => {
      println!("{}", herb::version());
    }
    "lex" => {
      if args.len() < 3 {
        eprintln!("Error: lex command requires a file argument");
        print_usage();
        std::process::exit(1);
      }
      let file_path = &args[2];
      lex_command(file_path);
    }
    "parse" => {
      if args.len() < 3 {
        eprintln!("Error: parse command requires a file argument");
        print_usage();
        std::process::exit(1);
      }
      let file_path = &args[2];
      parse_command(file_path);
    }
    "ruby" => {
      if args.len() < 3 {
        eprintln!("Error: ruby command requires a file argument");
        print_usage();
        std::process::exit(1);
      }
      let file_path = &args[2];
      ruby_command(file_path);
    }
    "html" => {
      if args.len() < 3 {
        eprintln!("Error: html command requires a file argument");
        print_usage();
        std::process::exit(1);
      }
      let file_path = &args[2];
      html_command(file_path);
    }
    _ => {
      eprintln!("Unknown command: {}", command);
      print_usage();
      std::process::exit(1);
    }
  }
}

fn lex_command(file_path: &str) {
  let source = match std::fs::read_to_string(file_path) {
    Ok(content) => content,
    Err(e) => {
      eprintln!("Error reading file '{}': {}", file_path, e);
      std::process::exit(1);
    }
  };

  let result = herb::lex(&source);
  for token in result.tokens() {
    println!("{}", token.inspect());
  }
}

fn parse_command(file_path: &str) {
  let source = match std::fs::read_to_string(file_path) {
    Ok(content) => content,
    Err(e) => {
      eprintln!("Error reading file '{}': {}", file_path, e);
      std::process::exit(1);
    }
  };

  match herb::parse(&source) {
    Ok(result) => {
      println!("{}", result.tree_inspect());
    }
    Err(e) => {
      eprintln!("Parse error: {}", e);
      std::process::exit(1);
    }
  }
}

fn ruby_command(file_path: &str) {
  let source = match std::fs::read_to_string(file_path) {
    Ok(content) => content,
    Err(e) => {
      eprintln!("Error reading file '{}': {}", file_path, e);
      std::process::exit(1);
    }
  };

  match herb::extract_ruby(&source) {
    Ok(ruby) => {
      print!("{}", ruby);
    }
    Err(e) => {
      eprintln!("Extract error: {}", e);
      std::process::exit(1);
    }
  }
}

fn html_command(file_path: &str) {
  let source = match std::fs::read_to_string(file_path) {
    Ok(content) => content,
    Err(e) => {
      eprintln!("Error reading file '{}': {}", file_path, e);
      std::process::exit(1);
    }
  };

  match herb::extract_html(&source) {
    Ok(html) => {
      print!("{}", html);
    }
    Err(e) => {
      eprintln!("Extract error: {}", e);
      std::process::exit(1);
    }
  }
}

fn print_usage() {
  println!("Usage: herb-rust [command] [file]");
  println!();
  println!("Herb 🌿 Powerful and seamless HTML-aware ERB parsing and tooling.");
  println!();
  println!("Commands:");
  println!("  version       - Show version information");
  println!("  lex [file]    - Lex a file");
  println!("  parse [file]  - Parse a file and display AST tree");
  println!("  ruby [file]   - Extract Ruby from a file");
  println!("  html [file]   - Extract HTML from a file");
}

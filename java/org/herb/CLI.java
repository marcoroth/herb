package org.herb;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;

public class CLI {
  public static void main(String[] args) {
    if (args.length < 1) {
      printUsage();

      System.exit(1);
    }

    String command = args[0];

    if (command.equals("version")) {
      System.out.println(Herb.version());

      return;
    }

    if (args.length < 2) {
      System.err.println("Please specify input file.");
      System.exit(1);
    }

    String filepath = args[1];
    String source;

    try {
      source = new String(Files.readAllBytes(Paths.get(filepath)));
    } catch (IOException e) {
      System.err.println("Error reading file: " + e.getMessage());
      System.exit(1);

      return;
    }

    switch (command) {

      case "lex":
        LexResult lexResult = Herb.lex(source);
        System.out.print(lexResult.inspect());
        break;

      case "parse":
        ParseResult parseResult = Herb.parse(source);
        System.out.print(parseResult.inspect());
        break;

      case "ruby":
        String ruby = Herb.extractRuby(source);
        System.out.println(ruby);

        break;

      case "html":
        String html = Herb.extractHTML(source);
        System.out.println(html);

        break;

      default:
        System.err.println("Unknown command: " + command);
        printUsage();

        System.exit(1);
    }
  }

  private static void printUsage() {
    System.out.println("Usage: bin/herb-java [command] [file]");
    System.out.println();
    System.out.println("Herb 🌿 Powerful and seamless HTML-aware ERB parsing and tooling.");
    System.out.println();
    System.out.println("Commands:");
    System.out.println("  version       - Show version information");
    System.out.println("  lex [file]    - Lex a file");
    System.out.println("  parse [file]  - Parse a file and display AST tree");
    System.out.println("  ruby [file]   - Extract Ruby from a file");
    System.out.println("  html [file]   - Extract HTML from a file");
  }
}

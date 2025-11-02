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
    Herb parser = Herb.create();

    if (command.equals("version")) {
      System.out.println(parser.getFullVersion());

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
        LexResult lexResult = parser.lex(source);

        if (lexResult.getTokens() != null) {
          for (Token token : lexResult.getTokens()) {
            System.out.println(token.inspect());
          }
        }
        break;

      case "parse":
        ParseResult parseResult = parser.parse(source);

        if (parseResult.getValue() != null) {
          System.out.print(parseResult.getValue().treeInspect());
        }

        if (parseResult.getErrors() != null && !parseResult.getErrors().isEmpty()) {
          System.out.println("Errors:");

          for (Object error : parseResult.getErrors()) {
            if (error instanceof org.herb.ast.Node) {
              System.out.println(((org.herb.ast.Node) error).treeInspect());
            } else {
              System.out.println("  " + error);
            }
          }
        }

        break;

      case "ruby":
        String ruby = parser.extractRuby(source);
        System.out.println(ruby);

        break;

      case "html":
        String html = parser.extractHTML(source);
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

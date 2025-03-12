{
  "targets": [
    {
      "target_name": "<(module_name)",
      "product_dir": "<(module_path)",
      "sources": [
        "./extension/herb.cpp",
        "./extension/error_helpers.cpp",
        "./extension/extension_helpers.cpp",
        "./extension/nodes.cpp",
        "./extension/libherb/array.c",
        "./extension/libherb/ast_node.c",
        "./extension/libherb/ast_nodes.c",
        "./extension/libherb/ast_pretty_print.c",
        "./extension/libherb/buffer.c",
        "./extension/libherb/errors.c",
        "./extension/libherb/extract.c",
        "./extension/libherb/herb.c",
        "./extension/libherb/html_util.c",
        "./extension/libherb/io.c",
        "./extension/libherb/json.c",
        "./extension/libherb/lexer.c",
        "./extension/libherb/lexer_peek_helpers.c",
        "./extension/libherb/location.c",
        "./extension/libherb/position.c",
        "./extension/libherb/memory.c",
        "./extension/libherb/parser.c",
        "./extension/libherb/parser_helpers.c",
        "./extension/libherb/pretty_print.c",
        "./extension/libherb/range.c",
        "./extension/libherb/token.c",
        "./extension/libherb/token_matchers.c",
        "./extension/libherb/util.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "./extension/libherb",
        "./extension/libherb/include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ]
    }
  ]
}

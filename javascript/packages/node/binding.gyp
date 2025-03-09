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
        "../../../src/array.c",
        "../../../src/ast_node.c",
        "../../../src/ast_nodes.c",
        "../../../src/ast_pretty_print.c",
        "../../../src/buffer.c",
        "../../../src/errors.c",
        "../../../src/extract.c",
        "../../../src/herb.c",
        "../../../src/html_util.c",
        "../../../src/io.c",
        "../../../src/json.c",
        "../../../src/lexer.c",
        "../../../src/lexer_peek_helpers.c",
        "../../../src/location.c",
        "../../../src/position.c",
        "../../../src/memory.c",
        "../../../src/parser.c",
        "../../../src/parser_helpers.c",
        "../../../src/pretty_print.c",
        "../../../src/range.c",
        "../../../src/token.c",
        "../../../src/token_matchers.c",
        "../../../src/util.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "../../../src",
        "../../../src/include",
        "<!@(bundle show prism)/include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "libraries": [
        "<!@(bundle show prism)/build/libprism.a"
      ]
    }
  ]
}

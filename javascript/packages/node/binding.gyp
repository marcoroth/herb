{
  "targets": [
    {
      "target_name": "<(module_name)",
      "product_dir": "<(module_path)",
      "sources": [
        "./extension/error_helpers.cpp",
        "./extension/extension_helpers.cpp",
        "./extension/herb.cpp",
        "./extension/nodes.cpp",

        # Herb main source files
        "./extension/libherb/analyze/analyze.c",
        "./extension/libherb/analyze/analyzed_ruby.c",
        "./extension/libherb/analyze/builders.c",
        "./extension/libherb/analyze/conditional_elements.c",
        "./extension/libherb/analyze/conditional_open_tags.c",
        "./extension/libherb/analyze/control_type.c",
        "./extension/libherb/analyze/helpers.c",
        "./extension/libherb/analyze/invalid_structures.c",
        "./extension/libherb/analyze/missing_end.c",
        "./extension/libherb/analyze/parse_errors.c",
        "./extension/libherb/analyze/transform.c",
        "./extension/libherb/ast_node.c",
        "./extension/libherb/ast_nodes.c",
        "./extension/libherb/ast_pretty_print.c",
        "./extension/libherb/element_source.c",
        "./extension/libherb/errors.c",
        "./extension/libherb/extract.c",
        "./extension/libherb/herb.c",
        "./extension/libherb/html_util.c",
        "./extension/libherb/io.c",
        "./extension/libherb/lexer_peek_helpers.c",
        "./extension/libherb/lexer.c",
        "./extension/libherb/location.c",
        "./extension/libherb/parser_helpers.c",
        "./extension/libherb/parser_match_tags.c",
        "./extension/libherb/parser.c",
        "./extension/libherb/position.c",
        "./extension/libherb/pretty_print.c",
        "./extension/libherb/prism_helpers.c",
        "./extension/libherb/range.c",
        "./extension/libherb/token_matchers.c",
        "./extension/libherb/token.c",
        "./extension/libherb/utf8.c",
        "./extension/libherb/util.c",
        "./extension/libherb/util/hb_arena.c",
        "./extension/libherb/util/hb_array.c",
        "./extension/libherb/util/hb_narray.c",
        "./extension/libherb/util/hb_buffer.c",
        "./extension/libherb/util/hb_string.c",
        "./extension/libherb/util/hb_system.c",
        "./extension/libherb/visitor.c",

        # Prism main source files
        "./extension/prism/src/diagnostic.c",
        "./extension/prism/src/encoding.c",
        "./extension/prism/src/node.c",
        "./extension/prism/src/options.c",
        "./extension/prism/src/pack.c",
        "./extension/prism/src/prettyprint.c",
        "./extension/prism/src/prism.c",
        "./extension/prism/src/regexp.c",
        "./extension/prism/src/serialize.c",
        "./extension/prism/src/static_literals.c",
        "./extension/prism/src/token_type.c",

        # Prism util source files
        "./extension/prism/src/util/pm_buffer.c",
        "./extension/prism/src/util/pm_char.c",
        "./extension/prism/src/util/pm_constant_pool.c",
        "./extension/prism/src/util/pm_integer.c",
        "./extension/prism/src/util/pm_list.c",
        "./extension/prism/src/util/pm_memchr.c",
        "./extension/prism/src/util/pm_newline_list.c",
        "./extension/prism/src/util/pm_string.c",
        "./extension/prism/src/util/pm_strncasecmp.c",
        "./extension/prism/src/util/pm_strpbrk.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "./extension/libherb",
        "./extension/libherb/include",
        "./extension/prism/include",
        "./extension/prism/src",
        "./extension/prism/src/util"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "defines": [
        "PRISM_EXPORT_SYMBOLS=static",
        "PRISM_STATIC=1",
        "HERB_EXCLUDE_PRETTYPRINT",
        "PRISM_EXCLUDE_PRETTYPRINT",
        "PRISM_EXCLUDE_JSON",
        "PRISM_EXCLUDE_PACK",
        "PRISM_EXCLUDE_SERIALIZATION"
      ],
      "cflags": [
        "-Wall",
        "-Wextra"
      ],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.15"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      }
    }
  ]
}

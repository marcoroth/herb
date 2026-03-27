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
        "./extension/libherb/analyze/analyze_helpers.c",
        "./extension/libherb/analyze/invalid_structures.c",
        "./extension/libherb/analyze/missing_end.c",
        "./extension/libherb/analyze/parse_errors.c",
        "./extension/libherb/analyze/prism_annotate.c",
        "./extension/libherb/analyze/render_nodes.c",
        "./extension/libherb/analyze/strict_locals.c",
        "./extension/libherb/analyze/transform.c",
        "./extension/libherb/analyze/action_view/attribute_extraction_helpers.c",
        "./extension/libherb/analyze/action_view/content_tag.c",
        "./extension/libherb/analyze/action_view/image_tag.c",
        "./extension/libherb/analyze/action_view/javascript_include_tag.c",
        "./extension/libherb/analyze/action_view/javascript_tag.c",
        "./extension/libherb/analyze/action_view/link_to.c",
        "./extension/libherb/analyze/action_view/registry.c",
        "./extension/libherb/analyze/action_view/tag_helper_node_builders.c",
        "./extension/libherb/analyze/action_view/tag_helpers.c",
        "./extension/libherb/analyze/action_view/tag.c",
        "./extension/libherb/analyze/action_view/turbo_frame_tag.c",
        "./extension/libherb/ast/ast_node.c",
        "./extension/libherb/ast/ast_nodes.c",
        "./extension/libherb/ast/ast_pretty_print.c",
        "./extension/libherb/ast/pretty_print.c",
        "./extension/libherb/errors.c",
        "./extension/libherb/extract.c",
        "./extension/libherb/herb.c",
        "./extension/libherb/lexer.c",
        "./extension/libherb/lexer/lexer_peek_helpers.c",
        "./extension/libherb/lexer/token.c",
        "./extension/libherb/lexer/token_matchers.c",
        "./extension/libherb/lib/hb_allocator.c",
        "./extension/libherb/lib/hb_arena.c",
        "./extension/libherb/lib/hb_arena_debug.c",
        "./extension/libherb/lib/hb_array.c",
        "./extension/libherb/lib/hb_buffer.c",
        "./extension/libherb/lib/hb_narray.c",
        "./extension/libherb/lib/hb_string.c",
        "./extension/libherb/location/location.c",
        "./extension/libherb/location/position.c",
        "./extension/libherb/location/range.c",
        "./extension/libherb/parser/dot_notation.c",
        "./extension/libherb/parser/match_tags.c",
        "./extension/libherb/parser/parser_helpers.c",
        "./extension/libherb/parser.c",
        "./extension/libherb/prism/prism_helpers.c",
        "./extension/libherb/prism/ruby_parser.c",
        "./extension/libherb/util/html_util.c",
        "./extension/libherb/util/io.c",
        "./extension/libherb/util/ruby_util.c",
        "./extension/libherb/util/utf8.c",
        "./extension/libherb/util/util.c",
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
        "PRISM_EXCLUDE_PACK"
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

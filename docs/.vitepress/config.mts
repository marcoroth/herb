import { defineConfig } from "vitepress"

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "🌿 Herb",
  description: "Seamless and powerful HTML-aware ERB parsing.",
  srcDir: "./docs",
  base: "/herb/",
  themeConfig: {

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Specification", link: "/specification" },
      { text: "Language Bindings", link: "/bindings/ruby/" },
    ],

    sidebar: [
      {
        text: "Specification",
        items: [
          { text: "General", link: "/specification" },
          { text: "HTML", link: "/specification/html" },
          { text: "ERB", link: "/specification/erb" },
          // { text: "Blade", link: "/specification/blade" },
          // { text: "EJS", link: "/specification/ejs" },
          // { text: "Handlebars", link: "/specification/handlebars" },
          // { text: "Jinja", link: "/specification/jinja" },
          // { text: "Liquid", link: "/specification/liquid" },
        ]
      },
      {
        text: "Language Bindings",
        items: [
          {
            text: "Ruby",
            collapsed: true,
            items: [
              { text: "Installation", link: "/bindings/ruby/"},
              { text: "Reference", link: "/bindings/ruby/reference"},
            ]
          },
          {
            text: "JavaScript/Node.js",
            collapsed: true,
            items: [
              { text: "Installation", link: "/bindings/javascript/"},
              { text: "Reference", link: "/bindings/javascript/reference"},
            ]
          },
        ]
      },
      {
        text: "AST",
        items: [
          { text: "Index", link: "/ast/" },
          {
            text: "Nodes",
            collapsed: true,
            items: [
              {
                text: "Basic",
                collapsed: true,
                items: [
                  { text: "LITERAL", link: "/ast/AST_LITERAL" },
                  { text: "STRING_COMPOUND", link: "/ast/AST_STRING_COMPOUND" },
                  { text: "HTML_WHITESPACE_NODE", link: "/ast/AST_HTML_WHITESPACE_NODE" },
                ]
              },
              {
                text: "Root Nodes",
                collapsed: true,
                items: [
                  { text: "HTML_ROOT_NODE", link: "/ast/AST_HTML_ROOT_NODE" },
                  { text: "HTML_DOCUMENT_NODE", link: "/ast/AST_DOCUMENT_NODE" },
                ]
              },
              {
                text: "HTML Nodes",
                collapsed: true,
                items: [
                  { text: "HTML_DOCTYPE_NODE", link: "/ast/AST_HTML_DOCTYPE_NODE" },
                  { text: "HTML_ELEMENT_NODE", link: "/ast/AST_HTML_ELEMENT_NODE" },
                  { text: "HTML_TEXT_NODE", link: "/ast/AST_HTML_TEXT_NODE" },
                  { text: "HTML_COMMENT_NODE", link: "/ast/AST_HTML_COMMENT_NODE" },
                ]
              },
              {
                text: "HTML Attributes",
                collapsed: true,
                items: [
                  { text: "HTML_ATTRIBUTE_SET_NODE", link: "/ast/AST_HTML_ATTRIBUTE_SET_NODE" },
                  { text: "HTML_ATTRIBUTE_NODE", link: "/ast/AST_HTML_ATTRIBUTE_NODE" },
                  { text: "HTML_ATTRIBUTE_NAME", link: "/ast/AST_HTML_ATTRIBUTE_NAME" },
                  { text: "HTML_ATTRIBUTE_VALUE", link: "/ast/AST_HTML_ATTRIBUTE_VALUE" },
                ]
              },
              {
                text: "ERB Basic Nodes",
                collapsed: true,
                items: [
                  { text: "ERB_EXPRESSION_NODE", link: "/ast/AST_ERB_EXPRESSION_NODE" },
                  { text: "ERB_STATEMENT_NODE", link: "/ast/AST_ERB_STATEMENT_NODE" },
                  { text: "ERB_RAW_NODE", link: "/ast/AST_ERB_RAW_NODE" },
                  { text: "ERB_COMMENT_NODE", link: "/ast/AST_ERB_COMMENT_NODE" },
                ]
              },
              {
                text: "ERB Control Flow Nodes",
                collapsed: true,
                items: [
                  { text: "ERB_BLOCK_NODE", link: "/ast/AST_ERB_BLOCK_NODE" },
                  { text: "ERB_CONDITIONAL_NODE", link: "/ast/AST_ERB_CONDITIONAL_NODE" },
                  { text: "ERB_ITERATION_NODE", link: "/ast/AST_ERB_ITERATION_NODE" },
                  { text: "ERB_FLOW_CONTROL_NODE", link: "/ast/AST_ERB_FLOW_CONTROL_NODE" },
                  { text: "ERB_BEGIN_RESCUE_NODE", link: "/ast/AST_ERB_BEGIN_RESCUE_NODE" },
                ]
              },
              {
                text: "ERB Special Nodes",
                collapsed: true,
                items: [
                  { text: "ERB_RENDER_CALL", link: "/ast/AST_ERB_RENDER_CALL" },
                  { text: "ERB_YIELD_NODE", link: "/ast/AST_ERB_YIELD_NODE" },
                  { text: "ERB_CONTENT_NODE", link: "/ast/AST_ERB_CONTENT_NODE" },
                ]
              },
            ]
          }
        ]
      },
      {
        text: "Tokens",
        items: [
          { text: "Index", link: "/tokens/" },
          {
            text: "Tokens",
            collapsed: true,
            items: [
              { text: "TOKEN_NEWLINE", link: "/tokens/TOKEN_NEWLINE" },
              { text: "TOKEN_WHITESPACE", link: "/tokens/TOKEN_WHITESPACE" },
            ]
          }
        ]
      },
      {
        text: "C-Structs",
        items: [
          { text: "Index", link: "/structs/" },
          {
            text: "C-Structs",
            collapsed: true,
            items: [
              { text: "array_T", link: "/structs/array" },
              { text: "buffer_T", link: "/structs/buffer" },
              { text: "position_T", link: "/structs/position" },
              { text: "range_T", link: "/structs/range" },
            ]
          }
        ]
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/marcoroth/herb" },
      { icon: "twitter", link: "https://twitter.com/marcoroth_" },
      { icon: "mastodon", link: "https://ruby.social/@marcoroth" }
    ]
  }
})

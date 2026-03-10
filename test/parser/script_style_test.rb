# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ScriptStyleTest < Minitest::Spec
    include SnapshotUtils

    test "script tag with less than comparison" do
      assert_parsed_snapshot(%(<script>if (x < 10) { console.log("less"); }</script>))
    end

    test "script tag with greater than comparison" do
      assert_parsed_snapshot(%(<script>if (x > 10) { console.log("greater"); }</script>))
    end

    test "script tag with HTML in string literal" do
      assert_parsed_snapshot(%(<script>var html = "<div class='test'>content</div>";</script>))
    end

    test "script tag with HTML in comment" do
      assert_parsed_snapshot(%(<script>// <div> should be ignored in comment</script>))
    end

    test "script tag with multiline comment containing HTML" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          /*
           * <div>This is in a comment</div>
           * <span>Also ignored</span>
           */
          console.log("test");
        </script>
      HTML
    end

    test "script tag with ERB-like content in string" do
      assert_parsed_snapshot(%(<script>console.log("<%");</script>))
    end

    test "script tag with incomplete ERB-like content" do
      assert_parsed_snapshot(%(<script>console.log("<%= incomplete");</script>))
    end

    test "script tag with closing script tag in string" do
      assert_parsed_snapshot(%(<script>var s = "</script>";</script>))
    end

    test "script tag with escaped closing tag in string" do
      assert_parsed_snapshot(%(<script>var s = "<\\/script>";</script>))
    end

    test "script tag with actual ERB interpolation" do
      assert_parsed_snapshot(%(<script>var userId = <%= @user.id %>;</script>))
    end

    test "script tag with multiple ERB interpolations" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          var config = {
            userId: <%= @user.id %>,
            userName: "<%= @user.name %>",
            isAdmin: <%= @user.admin? %>
          };
        </script>
      HTML
    end

    test "script tag with complex JavaScript including comparisons and HTML strings" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          function test() {
            if (x < 10 && y > 5) {
              return "<div>" + content + "</div>";
            }
            // <span>Comment with HTML</span>
            var template = `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
          }
        </script>
      HTML
    end

    test "style tag with child selector" do
      assert_parsed_snapshot(%(<style>.parent > .child { color: red; }</style>))
    end

    test "style tag with attribute selector containing HTML" do
      assert_parsed_snapshot(%(<style>input[placeholder="<enter text>"] { color: blue; }</style>))
    end

    test "style tag with content property containing HTML" do
      assert_parsed_snapshot(%(<style>.icon::before { content: "<span>★</span>"; }</style>))
    end

    test "style tag with ERB interpolation" do
      assert_parsed_snapshot(%(<style>.user-<%= @user.id %> { color: <%= @theme_color %>; }</style>))
    end

    test "style tag with complex CSS including HTML-like content" do
      assert_parsed_snapshot(<<~HTML)
        <style>
          /* <div>Comment with HTML</div> */
          .tooltip::after {
            content: "<div class='arrow'></div>";
          }
          .container > .item:first-child {
            background: url("data:image/svg+xml,<svg><rect/></svg>");
          }
        </style>
      HTML
    end

    test "nested script tags (inner in string)" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          document.write('<script src="other.js"><' + '/script>');
        </script>
      HTML
    end

    test "script tag with regex containing angle brackets" do
      assert_parsed_snapshot(%(<script>var regex = /<[^>]+>/g;</script>))
    end

    test "style tag with media query and nested selectors" do
      assert_parsed_snapshot(<<~HTML)
        <style>
          @media (max-width: 768px) {
            .nav > ul > li {
              display: block;
            }
          }
        </style>
      HTML
    end

    test "script tag with template literals containing HTML" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          const template = `
            <div class="container">
              <h1>${title}</h1>
              <p>${content}</p>
            </div>
          `;
        </script>
      HTML
    end

    test "script tag with JSX-like syntax" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          const element = (
            <div className="greeting">
              <h1>Hello, {name}!</h1>
            </div>
          );
        </script>
      HTML
    end

    test "empty script and style tags" do
      assert_parsed_snapshot(%(<script></script><style></style>))
    end

    test "script tag followed by style tag with complex content" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          if (window.width < 768) {
            document.body.className = "mobile";
          }
        </script>
        <style>
          .mobile > .header {
            font-size: 14px;
          }
        </style>
      HTML
    end

    test "script tag with minified JavaScript containing many angle brackets" do
      assert_parsed_snapshot(%(<script>!function(){for(var i=0;i<10;i++)if(arr[i]>5&&arr[i]<15)console.log("<item>"+arr[i]+"</item>")}();</script>))
    end

    test "script tag with JSON containing HTML" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          var data = {
            "template": "<div class='widget'>{{content}}</div>",
            "items": ["<span>A</span>", "<span>B</span>"]
          };
        </script>
      HTML
    end

    test "style tag with CSS custom properties and calc" do
      assert_parsed_snapshot(<<~HTML)
        <style>
          :root {
            --arrow: "<";
            --content: ">";
          }
          .element {
            width: calc(100% - 20px);
          }
        </style>
      HTML
    end

    test "script tag with incomplete ERB tag at end" do
      assert_parsed_snapshot(%(<script>console.log("test"); <%</script>))
    end

    test "script tag with only ERB-like characters" do
      assert_parsed_snapshot(%(<script>var s = "<%"; var e = "%>";</script>))
    end

    test "real world example - Google Analytics" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
          (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
          m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
          })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
        </script>
      HTML
    end

    test "real world example - Klaviyo script from issue 271" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          // prettier-ignore
          !function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(n){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();
        </script>
      HTML
    end

    test "script tag with single quote strings containing closing tags" do
      assert_parsed_snapshot(%(<script>var s1 = '</script>'; var s2 = '</style>';</script>))
    end

    test "script tag with double quote strings containing closing tags" do
      assert_parsed_snapshot(%(<script>var s1 = "</script>"; var s2 = "</style>";</script>))
    end

    test "script tag with template literals containing closing tags" do
      assert_parsed_snapshot(%(<script>var template = `</script>`;</script>))
    end

    test "script tag with escaped quotes in strings" do
      assert_parsed_snapshot(%(<script>var s = "He said \\"</script>\\" yesterday";</script>))
    end

    test "style tag with quotes containing HTML-like content" do
      assert_parsed_snapshot(%(<style>.icon::before { content: "</style>"; }</style>))
    end

    test "script tag with mixed quote types and closing tags" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          var single = '</script>';
          var double = "</script>";
          console.log("All strings parsed correctly");
        </script>
      HTML
    end

    test "script tag with ERB inside string literals (ERB always processed)" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          var message = "<%= @greeting %>";
          var template = '<%= @template %>';
          var config = `<%= @config %>`;
        </script>
      HTML
    end

    test "script tag with ERB outside vs inside strings" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          var outside = <%= @value %>;
          var inside = "<%= @value %>";
          var mixed = "Hello " + <%= @name %> + " world";
        </script>
      HTML
    end

    test "script tag with ERB in double quotes" do
      assert_parsed_snapshot(%(<script>var msg = "Hello <%= @user.name %> world";</script>))
    end

    test "script tag with ERB in single quotes" do
      assert_parsed_snapshot(%(<script>var msg = 'Hello <%= @user.name %> world';</script>))
    end

    test "script tag with ERB in template literals" do
      assert_parsed_snapshot(%(<script>var msg = `Hello <%= @user.name %> world`;</script>))
    end

    test "script tag with multiple ERB tags in one string" do
      assert_parsed_snapshot(%(<script>var info = "User <%= @user.id %>: <%= @user.name %>";</script>))
    end

    test "script tag with ERB in different quote types same line" do
      assert_parsed_snapshot(%(<script>var a = "ERB: <%= @a %>"; var b = 'ERB: <%= @b %>';</script>))
    end

    test "style tag with ERB in CSS strings" do
      assert_parsed_snapshot(<<~HTML)
        <style>
          .dynamic::before {
            content: "Generated: <%= @timestamp %>";
            background: url('<%= @image_path %>');
          }
        </style>
      HTML
    end

    test "script tag with closing tag in single-line comment" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          // </script>
        </script>
      HTML
    end

    test "script tag with closing tag in multi-line comment" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          /* </script> */
        </script>
      HTML
    end

    test "script tag with closing tag in complex multi-line comment" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          /*
           * This is a comment with </script> inside
           * and some more content </style>
           */
          console.log("actual code");
        </script>
      HTML
    end

    test "script tag with mixed comments and strings" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          // Comment with </script>
          var str = "String with </script>";
          /* Multi-line comment
             with </script> inside */
          var another = 'Single quote </script>';
        </script>
      HTML
    end

    test "script tag with nested comment markers" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          // First comment // with nested comment marker
          /* Outer comment /* with nested comment marker */ still in comment */
          console.log("done");
        </script>
      HTML
    end

    test "script tag with ERB in comments" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          // ERB in comment: <%= @value %>
          /* Multi-line ERB: <%= @data %> */
          var result = <%= @actual_erb %>;
        </script>
      HTML
    end

    test "script tag with complex multi-line comment containing closing tag" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          /*
           * </script>
           */
        </script>
      HTML
    end

    test "script tag with template literal containing closing tag (multiline)" do
      assert_parsed_snapshot(<<~HTML)
        <script>
          `</script>`
        </script>
      HTML
    end

    test "script tag with closing tag on comment line" do
      assert_parsed_snapshot(<<~HTML)
        <div>Before</div>

        <script>
          // </script>

        <div>After</div>
      HTML
    end

    test "script tag with closing div tag in string" do
      assert_parsed_snapshot(%(<script>var s = "</div>";</script>))
    end
  end
end

import { describe, test } from "vitest"
import { HTMLNoUnknownTagRule } from "../../src/rules/html-no-unknown-tag.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectWarning, assertOffenses } = createLinterTest(HTMLNoUnknownTagRule)

describe("html-no-unknown-tag", () => {
  describe("standard HTML elements pass", () => {
    test("block-level elements", () => {
      expectNoOffenses(`
        <div></div>
        <section></section>
        <article></article>
        <aside></aside>
        <main></main>
        <nav></nav>
        <header></header>
        <footer></footer>
        <blockquote></blockquote>
        <details></details>
        <dialog></dialog>
        <figure></figure>
        <figcaption></figcaption>
        <address></address>
        <hgroup></hgroup>
        <search></search>
      `)
    })

    test("inline elements", () => {
      expectNoOffenses(`
        <span></span>
        <a href="#"></a>
        <strong></strong>
        <em></em>
        <b></b>
        <i></i>
        <small></small>
        <code></code>
        <kbd></kbd>
        <abbr></abbr>
        <cite></cite>
        <dfn></dfn>
        <mark></mark>
        <q></q>
        <s></s>
        <u></u>
        <sub></sub>
        <sup></sup>
        <time></time>
        <data></data>
        <var></var>
        <samp></samp>
        <bdi></bdi>
        <bdo></bdo>
      `)
    })

    test("void elements", () => {
      expectNoOffenses(`
        <br>
        <hr>
        <img src="test.png" alt="test">
        <input type="text">
        <link rel="stylesheet" href="style.css">
        <meta charset="utf-8">
        <area>
        <base href="/">
        <col>
        <embed>
        <source>
        <track>
        <wbr>
        <param>
      `)
    })

    test("heading elements", () => {
      expectNoOffenses(`
        <h1>Title</h1>
        <h2>Subtitle</h2>
        <h3>Section</h3>
        <h4>Subsection</h4>
        <h5>Minor</h5>
        <h6>Smallest</h6>
      `)
    })

    test("table elements", () => {
      expectNoOffenses(`
        <table>
          <caption>Table</caption>
          <colgroup><col></colgroup>
          <thead><tr><th>Header</th></tr></thead>
          <tbody><tr><td>Data</td></tr></tbody>
          <tfoot><tr><td>Footer</td></tr></tfoot>
        </table>
      `)
    })

    test("form elements", () => {
      expectNoOffenses(`
        <form>
          <fieldset>
            <legend>Form</legend>
            <label>Name</label>
            <input type="text">
            <select><optgroup><option>A</option></optgroup></select>
            <textarea></textarea>
            <button>Submit</button>
            <datalist></datalist>
            <output></output>
            <meter></meter>
            <progress></progress>
          </fieldset>
        </form>
      `)
    })

    test("media and embedded content elements", () => {
      expectNoOffenses(`
        <audio></audio>
        <video></video>
        <picture></picture>
        <canvas></canvas>
        <iframe></iframe>
        <object></object>
        <embed>
        <map></map>
      `)
    })

    test("ruby annotation elements", () => {
      expectNoOffenses(`
        <ruby>
          <rp>(</rp>
          <rt>annotation</rt>
          <rp>)</rp>
        </ruby>
      `)
    })

    test("interactive elements", () => {
      expectNoOffenses(`
        <details>
          <summary>Click to expand</summary>
          <p>Content</p>
        </details>
        <dialog></dialog>
      `)
    })

    test("document structure elements", () => {
      expectNoOffenses(`
        <html>
          <head>
            <title>Test</title>
          </head>
          <body></body>
        </html>
      `)
    })

    test("edit elements", () => {
      expectNoOffenses(`
        <p>This is <del>deleted</del> and <ins>inserted</ins> text.</p>
      `)
    })

    test("template and slot elements", () => {
      expectNoOffenses(`
        <template>
          <slot></slot>
        </template>
      `)
    })

    test("list elements", () => {
      expectNoOffenses(`
        <ul><li>item</li></ul>
        <ol><li>item</li></ol>
        <dl><dt>term</dt><dd>definition</dd></dl>
        <menu><li>item</li></menu>
      `)
    })

    test("deprecated but still valid elements", () => {
      expectNoOffenses(`
        <acronym>HTML</acronym>
        <big>large text</big>
        <tt>monospace</tt>
      `)
    })

    test("scripting elements", () => {
      expectNoOffenses(`
        <script></script>
        <noscript></noscript>
      `)
    })
  })

  describe("unknown elements are flagged", () => {
    test("simple unknown element", () => {
      expectWarning('Unknown HTML tag `<hello>`. This is not a standard HTML element.')
      assertOffenses(`<hello></hello>`)
    })

    test("another unknown element", () => {
      expectWarning('Unknown HTML tag `<foo>`. This is not a standard HTML element.')
      assertOffenses(`<foo></foo>`)
    })

    test("multiple unknown elements", () => {
      expectWarning('Unknown HTML tag `<hello>`. This is not a standard HTML element.')
      expectWarning('Unknown HTML tag `<world>`. This is not a standard HTML element.')
      assertOffenses(`
        <hello></hello>
        <world></world>
      `)
    })

    test("nested unknown element", () => {
      expectWarning('Unknown HTML tag `<unknown>`. This is not a standard HTML element.')
      assertOffenses(`
        <div>
          <unknown></unknown>
        </div>
      `)
    })

    test("underscore-separated element", () => {
      expectWarning('Unknown HTML tag `<my_component>`. This is not a standard HTML element. Did you mean `<my-component>`? Custom elements must contain a hyphen.')
      assertOffenses(`<my_component></my_component>`)
    })

    test("multiple underscore-separated elements", () => {
      expectWarning('Unknown HTML tag `<my_component>`. This is not a standard HTML element. Did you mean `<my-component>`? Custom elements must contain a hyphen.')
      expectWarning('Unknown HTML tag `<my_component_name>`. This is not a standard HTML element. Did you mean `<my-component-name>`? Custom elements must contain a hyphen.')

      assertOffenses(`
        <my_component></my_component>
        <my_component_name></my_component_name>
      `)
    })
  })

  describe("custom elements pass", () => {
    test("single hyphen custom element", () => {
      expectNoOffenses(`<my-component></my-component>`)
    })

    test("multiple hyphens custom element", () => {
      expectNoOffenses(`<my-fancy-component></my-fancy-component>`)
    })

    test("Turbo elements", () => {
      expectNoOffenses(`
        <turbo-frame id="frame"></turbo-frame>
        <turbo-stream></turbo-stream>
        <turbo-cable-stream-source></turbo-cable-stream-source>
      `)
    })

    test("various web component patterns", () => {
      expectNoOffenses(`
        <x-button></x-button>
        <app-header></app-header>
        <ui-modal></ui-modal>
      `)
    })
  })

  describe("SVG context is skipped", () => {
    test("svg element itself passes", () => {
      expectNoOffenses(`<svg></svg>`)
    })

    test("svg children are not flagged", () => {
      expectNoOffenses(`
        <svg viewBox="0 0 24 24">
          <path d="M0 0h24v24H0z"></path>
          <circle cx="12" cy="12" r="10"></circle>
          <rect x="0" y="0" width="24" height="24"></rect>
          <line x1="0" y1="0" x2="24" y2="24"></line>
          <polygon points="0,0 24,0 12,24"></polygon>
          <g>
            <text>Hello</text>
          </g>
        </svg>
      `)
    })

    test("unknown elements outside svg are flagged but svg children are not", () => {
      expectWarning('Unknown HTML tag `<foo>`. This is not a standard HTML element.')

      assertOffenses(`
        <foo></foo>
        <svg viewBox="0 0 24 24">
          <path d="M0 0h24v24H0z"></path>
        </svg>
      `)
    })
  })

  describe("SVG elements without svg wrapper are not flagged", () => {
    test("lowercase SVG elements in partials", () => {
      expectNoOffenses(`
        <circle cx="12" cy="12" r="10"></circle>
        <rect x="0" y="0" width="24" height="24"></rect>
        <path d="M0 0h24v24H0z"></path>
        <line x1="0" y1="0" x2="24" y2="24"></line>
        <polygon points="0,0 24,0 12,24"></polygon>
        <polyline points="0,0 24,0 12,24"></polyline>
        <ellipse cx="12" cy="12" rx="10" ry="5"></ellipse>
        <g></g>
        <defs></defs>
        <use href="#icon"></use>
        <symbol id="icon"></symbol>
        <marker></marker>
        <mask></mask>
        <filter></filter>
        <image></image>
        <text>Hello</text>
        <tspan>World</tspan>
        <desc>Description</desc>
        <metadata></metadata>
        <pattern></pattern>
        <animate attributeName="opacity" values="0;1" dur="1s"></animate>
        <stop></stop>
        <switch></switch>
        <set></set>
      `)
    })

    test("SVG filter elements in partials (camelCase as lowercase)", () => {
      expectNoOffenses(`
        <fedisplacementmap in="SourceGraphic" in2="noise"></fedisplacementmap>
        <feturbulence type="turbulence" basefrequency="0.05"></feturbulence>
        <fegaussianblur stddeviation="5"></fegaussianblur>
        <feblend mode="multiply"></feblend>
        <fecolormatrix type="saturate" values="0.5"></fecolormatrix>
        <fecomposite operator="in"></fecomposite>
        <feflood flood-color="red"></feflood>
        <feimage href="image.png"></feimage>
        <femerge></femerge>
        <femergenode></femergenode>
        <femorphology operator="dilate" radius="2"></femorphology>
        <feoffset dx="5" dy="5"></feoffset>
        <fedropshadow dx="2" dy="2"></fedropshadow>
        <fediffuselighting></fediffuselighting>
        <fespecularlighting></fespecularlighting>
        <fepointlight></fepointlight>
        <fedistantlight></fedistantlight>
        <fespotlight></fespotlight>
        <fetile></fetile>
        <feconvolvematrix></feconvolvematrix>
        <fecomponenttransfer></fecomponenttransfer>
        <fefunca></fefunca>
        <fefuncb></fefuncb>
        <fefuncg></fefuncg>
        <fefuncr></fefuncr>
      `)
    })

    test("other camelCase SVG elements as lowercase", () => {
      expectNoOffenses(`
        <clippath></clippath>
        <lineargradient></lineargradient>
        <radialgradient></radialgradient>
        <textpath></textpath>
        <foreignobject></foreignobject>
        <animatemotion></animatemotion>
        <animatetransform></animatetransform>
      `)
    })
  })

  describe("MathML context is skipped", () => {
    test("math element itself passes", () => {
      expectNoOffenses(`<math></math>`)
    })

    test("math children are not flagged", () => {
      expectNoOffenses(`
        <math>
          <mrow>
            <mi>x</mi>
            <mo>=</mo>
            <mfrac>
              <mn>1</mn>
              <mn>2</mn>
            </mfrac>
          </mrow>
        </math>
      `)
    })
  })

  describe("MathML elements without math wrapper are not flagged", () => {
    test("MathML elements in partials", () => {
      expectNoOffenses(`
        <mrow></mrow>
        <mi>x</mi>
        <mn>2</mn>
        <mo>=</mo>
        <mfrac><mn>1</mn><mn>2</mn></mfrac>
        <msqrt><mn>4</mn></msqrt>
        <mroot><mn>8</mn><mn>3</mn></mroot>
        <msub><mi>x</mi><mn>1</mn></msub>
        <msup><mi>x</mi><mn>2</mn></msup>
        <msubsup><mi>x</mi><mn>1</mn><mn>2</mn></msubsup>
        <munder><mi>x</mi><mo>_</mo></munder>
        <mover><mi>x</mi><mo>^</mo></mover>
        <munderover><mi>x</mi><mo>_</mo><mo>^</mo></munderover>
        <mtable><mtr><mtd></mtd></mtr></mtable>
        <mtext>text</mtext>
        <mspace></mspace>
        <mpadded></mpadded>
        <mphantom></mphantom>
        <menclose></menclose>
        <merror></merror>
        <mstyle></mstyle>
        <maction></maction>
        <semantics></semantics>
        <annotation>text</annotation>
        <annotation-xml></annotation-xml>
      `)
    })
  })

  describe("component elements (uppercase) are skipped", () => {
    test("PascalCase element", () => {
      expectNoOffenses(`<Button></Button>`)
    })

    test("namespaced component with double colon", () => {
      expectNoOffenses(`<UI::Button></UI::Button>`)
    })

    test("dot-separated component", () => {
      expectNoOffenses(`<UI.Button></UI.Button>`)
    })

    test("single uppercase word component", () => {
      expectNoOffenses(`<Card></Card>`)
    })

    test("nested component elements", () => {
      expectNoOffenses(`
        <Layout>
          <Header></Header>
          <Content></Content>
          <Footer></Footer>
        </Layout>
      `)
    })

    test("component inside standard HTML", () => {
      expectNoOffenses(`
        <div>
          <Button></Button>
        </div>
      `)
    })

    test("lowercase unknown element next to component is still flagged", () => {
      expectWarning('Unknown HTML tag `<foo>`. This is not a standard HTML element.')

      assertOffenses(`
        <Button></Button>
        <foo></foo>
      `)
    })
  })

  describe("ERB tag helpers", () => {
    test("tag.div passes", () => {
      expectNoOffenses(`<%= tag.div do %>content<% end %>`)
    })

    test("tag.span passes", () => {
      expectNoOffenses(`<%= tag.span do %>content<% end %>`)
    })

    test("tag.hello is flagged", () => {
      expectWarning('Unknown HTML tag `<hello>`. This is not a standard HTML element.')

      assertOffenses(`<%= tag.hello do %>content<% end %>`)
    })

    test("tag.my_component passes because underscores are translated to hyphens", () => {
      expectNoOffenses(`<%= tag.my_component do %>content<% end %>`)
    })

    test("tag.send is not statically resolvable and passes", () => {
      expectNoOffenses(`<%= tag.send("hello", id: "frame") do %>content<% end %>`)
    })

    test("tag.send for custom element passes", () => {
      expectNoOffenses(`<%= tag.send("turbo-frame", id: "frame") do %>content<% end %>`)
    })
  })
})

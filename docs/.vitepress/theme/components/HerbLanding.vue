<script setup>
const companies = [
  { login: "Light-Labs-Technologies", name: "Light Labs" },
  { login: "renuo", name: "renuo" },
  { login: "honestica", name: "Lifen" },
  { login: "typesense", name: "Typesense" },
  { login: "ventrata", name: "Ventrata" },
  { login: "BaseSecrete", name: "Base Secrète" },
  { login: "beflagrant", name: "Flagrant" },
  { login: "linkanalabs", name: "Linkana" },
  { login: "avo-hq", name: "Avo" },
  { login: "practical-computer", name: "Practical Computer" },
]

const people = [
  "wbotelhos", "jespr", "DRBragg", "peterberkenbosch", "kcdragon", "ChaelCodes",
  "larouxn", "lxxxvi", "williamkennedy", "janko", "irinanazarova", "gurgeous",
  "kdaigle", "rafaelfranca", "cb341", "myabc", "ajaya", "doolin", "sobstel",
  "apiguy", "rosa", "tysongach", "palkan", "itsameandrea", "markokajzer",
  "chris-biagini",
]

const total = companies.length + people.length
</script>

<template>
  <div class="herb-landing">
    <div class="wrap">
      <header class="hero">
        <div class="hero-grid">
          <div class="hero-copy">
        <p class="ships"><span class="dot"></span> Ships with Rails 8.2</p>

        <h1>A modern templating language for the <em>HTML+ERB</em> you already have.</h1>

        <p class="hero-sub">One language and toolchain that understands your HTML and Ruby together.</p>

        <p class="verbs">Lint <span>·</span> Format <span>·</span> Analyze <span>·</span> Render <span>·</span> Tooling</p>

        <div class="cta-row">
          <a class="btn btn-primary" href="/overview">Get started</a>
          <a class="btn btn-secondary" href="/playground">Try it in the browser</a>
          <a class="btn btn-secondary" href="/language/">Language reference</a>
        </div>
          </div>

          <div class="hero-art">
            <img src="/herb.svg" alt="Herb" width="260" height="260" data-no-zoom>
          </div>
        </div>

        <div class="hero-demo">
          <p class="term-label">herb-lint app/views/users/show.html.erb</p>
          <div class="diag">
            <p class="diag-head">[<span class="warnq bold">warning</span>] Prefer <span class="attr">`image_tag`</span> helper over manual <span class="attr">`&lt;img&gt;`</span> with dynamic ERB expressions. (<span class="rule">erb-prefer-image-tag-helper</span>)</p>

            <p class="diag-loc"><span class="b">app/views/users/show.html.erb</span>:<span class="b">2:7</span></p>

            <pre class="diag-frame">    <span class="dim prev">  1</span> <span class="dim">│</span> <span class="prev"><span class="tag">&lt;div</span> <span class="attr">class</span><span class="eq">=</span><span class="str">"avatar"</span><span class="tag">&gt;</span></span>
<span class="warnq">  → </span><span class="bold">  2</span> <span class="dim">│</span>   <span class="tag">&lt;img</span> <span class="attr">src</span><span class="eq">=</span><span class="str">"</span><span class="erb">&lt;%=</span> user.avatar_url <span class="erb">%&gt;</span><span class="str">"</span><span class="tag">&gt;</span>
        <span class="dim">│</span>        <span class="warnq">~~~~~~~~~~~~~~~~~~~~~~~~~~~~</span>
    <span class="dim prev">  3</span> <span class="dim">│</span> <span class="prev"><span class="tag">&lt;/div&gt;</span></span></pre>

            <p class="diag-sep">[1/2]</p>

            <p class="diag-head">[<span class="warnq bold">warning</span>] Missing required <span class="attr">`alt`</span> attribute on <span class="attr">`&lt;img&gt;`</span> tag. (<span class="rule">html-img-require-alt</span>)</p>

            <pre class="diag-frame"> <span class="bold">Summary:</span>
  <span class="dim">Checked     </span> <span class="b">1 file</span>
  <span class="dim">Offenses    </span> <span class="warnq bold">2 warnings</span>
  <span class="dim">Rules       </span> <span class="g bold">146 enabled</span> <span class="dim">|</span> <span class="b">22 not enabled</span>
  <span class="dim">Duration    </span> <span class="b">34ms</span></pre>
          </div>
        </div>
      </header>

      <section>
        <div class="sec-head">
          <h2>Your HTML+ERB, upgraded.</h2>
          <p>The same files you have now, understood properly for the first time.</p>
        </div>

        <div class="caps">
          <div class="cap">
            <div class="cap-text">
              <h3>Catch mistakes before they ship</h3>
              <p>168 rules covering accessibility, HTML correctness, Action View usage and security, with 146 on by default. Run them in your editor, on commit, or in CI.</p>
            </div>
            <div>
              <pre class="term"><span class="dim">$</span> herb-lint

 <span class="bold">Rule offenses:</span>
  <span class="rule">a11y-avoid-generic-link-text</span> <span class="dim">(14 offenses in 9 files)</span>
  <span class="rule">actionview-no-implicit-partial</span> <span class="dim">(6 offenses in 4 files)</span>
  <span class="rule">html-img-require-alt</span> <span class="dim">(3 offenses in 3 files)</span>

 <span class="bold">Summary:</span>
  <span class="dim">Checked     </span> <span class="b">144 files</span>
  <span class="dim">Offenses    </span> <span class="warnq bold">23 warnings</span>
  <span class="dim">Fixable     </span> <span class="g bold">9 offenses</span></pre>
            </div>
          </div>

          <div class="cap">
            <div class="cap-text">
              <h3>Format templates automatically</h3>
              <p>Indentation, line wrapping and attribute layout that respect both the HTML tree and the ERB inside it. Nothing gets reflowed into the wrong branch.</p>
            </div>
            <div>
              <pre class="term"><span class="dim">before</span>
<span class="b">&lt;div  </span><span class="a">class</span>=<span class="g">"card"</span>   <span class="a">id</span>=<span class="g">"u"</span><span class="b">&gt;</span><span class="g">&lt;%= u.name %&gt;</span><span class="b">&lt;/div&gt;</span>

<span class="dim">after</span>
<span class="b">&lt;div</span> <span class="a">class</span>=<span class="g">"card"</span> <span class="a">id</span>=<span class="g">"u"</span><span class="b">&gt;</span>
  <span class="g">&lt;%= u.name %&gt;</span>
<span class="b">&lt;/div&gt;</span></pre>
            </div>
          </div>

          <div class="cap">
            <div class="cap-text">
              <h3>Understand templates in your editor</h3>
              <p>Hover, go to definition, diagnostics and code actions for HTML+ERB. Works in VS Code, Zed, Neovim and anything else that speaks LSP.</p>
            </div>
            <div>
              <pre class="term"><span class="b">&lt;%=</span> render <span class="g">"users/card"</span>, user: user <span class="b">%&gt;</span>
             <span class="dim">└─ app/views/users/_card.html.erb</span>

             <span class="dim">strict locals:</span>
               <span class="a">user:</span>     <span class="dim">required</span>
               <span class="a">compact:</span>  <span class="dim">= false</span></pre>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="sec-head">
          <h2>You already know Herb.</h2>
        </div>

        <div class="split">
          <div>
            <p class="term-label">app/views/users/show.html.erb</p>
            <pre class="term"><span class="b">&lt;h1&gt;</span>Hello, <span class="g">&lt;%= @user.name %&gt;</span><span class="b">&lt;/h1&gt;</span>

<span class="g">&lt;% if @user.admin? %&gt;</span>
  <span class="b">&lt;span</span> <span class="a">class</span>=<span class="g">"badge"</span><span class="b">&gt;</span>Admin<span class="b">&lt;/span&gt;</span>
<span class="g">&lt;% end %&gt;</span></pre>
          </div>
          <div class="narrow">
            <p>That is Herb. Your existing <code>.html.erb</code> templates are already valid Herb templates, so there is nothing to rename and no new syntax to learn.</p>
            <p class="punch">There is nothing to learn.<br><span>You already know Herb.</span></p>
          </div>
        </div>
      </section>

      <section>
        <div class="sec-head">
          <h2>Your editor and your server see the same template.</h2>
          <p>Everything below is built on the same parser, so the linter, the formatter, your editor and the renderer all share one foundation.</p>
        </div>

        <div class="eco">
          <div class="eco-group">
            <h3>Working with HTML+ERB</h3>
            <p class="eco-when">Development and CI</p>
            <ul>
              <li><a href="/projects/linter">Linter</a></li>
              <li><a href="/projects/formatter">Formatter</a> <em>experimental</em></li>
              <li><a href="/projects/language-server">Language Server</a></li>
              <li><a href="/projects/dev-server">Dev Server</a> <em>experimental</em></li>
              <li><a href="/projects/dev-tools">Dev Tools</a></li>
            </ul>
          </div>

          <div class="eco-group">
            <h3>Rendering HTML+ERB</h3>
            <p class="eco-when">Production runtime</p>
            <ul>
              <li><a href="/projects/engine">Herb::Engine</a></li>
              <li><a href="/projects/client">Client Runtime</a> <em>experimental</em></li>
              <li><a href="https://reactionview.dev">ReActionView</a></li>
            </ul>
          </div>

          <div class="eco-group">
            <h3>Building on Herb</h3>
            <p class="eco-when">Wherever you call them</p>
            <ul>
              <li><a href="/projects/parser">Parser</a> <em>libherb, C</em></li>
              <li><a href="/projects/core">Core</a></li>
              <li><a href="/projects/analysis">Analysis</a></li>
              <li><a href="/projects/language-service">Language Service</a></li>
              <li><a href="/projects/printer">Syntax Tree Printer</a></li>
              <li><a href="/projects/rewriter">Rewriter</a></li>
              <li><a href="/projects/highlighter">Highlighter</a></li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <div class="sec-head">
          <h2>You may already have it.</h2>
          <p>Herb ships inside tools you already use, so there is a good chance you are already running it without having it installed explicitly.</p>
        </div>

        <div class="grid3">
          <div class="tile">
            <h3>Rails 8.2</h3>
            <p><code>Herb::Engine</code> is the default for HTML-format templates. Your <code>.html.erb</code> views render through Herb with nothing configured, and other formats such as <code>.json.erb</code> fall back to Erubi.</p>
          </div>
          <div class="tile">
            <h3>Tilt 2.9.0</h3>
            <p>Ships a Herb template registered for <code>.herb</code> and <code>.html.erb</code>. Tilt is the template interface behind Sinatra, Roda and Hanami's view layer, so Herb is available there with no wiring of your own.</p>
          </div>
          <div class="tile">
            <h3>Zed</h3>
            <p>The Herb Language Server comes pre-installed with Zed's official Ruby extension. Install the Ruby extension and it is there.</p>
          </div>
        </div>
      </section>

      <section>
        <div class="pointer">
          <h3>Supercharging Herb with ReActionView</h3>
          <p>Want to take your templates further and build dynamic interfaces without a JavaScript framework? ReActionView makes your existing HTML+ERB templates reactive, with fine-grained updates down to a single value, attribute or row, and no new syntax or build step.</p>
          <p><a href="https://reactionview.dev">Explore ReActionView →</a></p>
        </div>
      </section>

      <section>
        <div class="sec-head">
          <h2>Supported by {{ total }} people and companies.</h2>
          <p>Herb is an independent open source project, and it relies on the companies that use it to keep going. If your team depends on Herb, consider sponsoring the project.</p>
        </div>

        <p class="sponsor-label">Companies</p>
        <ul class="orgs">
          <li v-for="company in companies" :key="company.login">
            <a :href="`https://github.com/${company.login}`">
              <img :src="`https://github.com/${company.login}.png?size=80`" :alt="company.name" width="28" height="28" loading="lazy" data-no-zoom>
              <span>{{ company.name }}</span>
            </a>
          </li>
        </ul>

        <p class="sponsor-label">People</p>
        <ul class="people">
          <li v-for="login in people" :key="login">
            <a :href="`https://github.com/${login}`" :title="login">
              <img :src="`https://github.com/${login}.png?size=80`" :alt="login" width="40" height="40" loading="lazy" data-no-zoom>
            </a>
          </li>
        </ul>

        <p class="sponsor-note">
          <a class="btn btn-secondary" href="https://github.com/sponsors/marcoroth">Sponsor Herb on GitHub</a>
        </p>
        <p class="sponsor-why">Herb is created and led by <a href="https://github.com/marcoroth">Marco Roth</a>, with help from its <a href="/about">contributors</a>.</p>

        <div class="grant">
          <p><span class="grant-eyebrow">Grant</span> <strong>2026 Gem Fellow.</strong> Herb was one of eight projects selected for the <a href="https://gem.coop/updates/2026-fellowship/">2026 Gem Fellowship</a>, a grant partnership between <a href="https://gem.coop">gem.coop</a> and <a href="https://contribsys.com">Contributed Systems</a>, the company behind Sidekiq. It funded stabilization work toward 1.0 and the groundwork for reactive rendering. <a href="/blog/whats-new-in-herb-v0-10#gem-fellowship-final-report">Read the final report →</a></p>
        </div>
      </section>

      <section class="closing">
        <div class="sec-head">
          <h2>Run it on the templates you have.</h2>
          <p>Nothing to add to your Gemfile. This parses every template in the project and reports what it finds.</p>
        </div>

        <pre class="term"><span class="dim">$</span> gem exec herb analyze</pre>

        <div class="cta-row" style="margin-top: 2rem;">
          <a class="btn btn-primary" href="/installation">Installation</a>
          <a class="btn btn-secondary" href="/language/">Language reference</a>
          <a class="btn btn-secondary" href="https://github.com/marcoroth/herb">GitHub</a>
        </div>
      </section>
    </div>
  </div>
</template>

<style>
.herb-landing {
  --ground: var(--vp-c-bg);
  --surface: var(--vp-c-bg-soft);
  --sunk: var(--vp-c-bg-soft);
  --ink: var(--vp-c-text-1);
  --ink-soft: var(--vp-c-text-2);
  --ink-faint: var(--vp-c-text-3);
  --rule: var(--vp-c-divider);
  --accent: var(--vp-c-brand-1);
  --accent-soft: var(--vp-c-brand-soft);
  --accent-line: var(--vp-c-brand-2);
  --term-bg: #0f1815;
  --term-fg: #dfe8e1;
  --term-dim: #6e837a;
  --term-green: #7fcfa0;
  --term-red: #e08878;
  --term-blue: #8fb6d6;
  --mono: var(--vp-font-family-mono);
  --measure: 64ch;
  --pad: clamp(1.25rem, 5vw, 3.5rem);

  color: var(--ink);
  font-size: 1.0625rem;
  line-height: 1.65;
}

.herb-landing { padding: 0 1.5rem; }
@media (min-width: 48rem) { .herb-landing { padding: 0 2rem; } }
.herb-landing .wrap { max-width: calc(var(--vp-layout-max-width) - 4rem); margin: 0 auto; padding: 0; }
.herb-landing .narrow { max-width: var(--measure); }
.herb-landing h1, .herb-landing h2, .herb-landing h3 { margin: 0; line-height: 1.1; text-wrap: balance; }
.herb-landing p { margin: 0 0 1.1rem; }
.herb-landing p:last-child { margin-bottom: 0; }
.herb-landing code { font-family: var(--mono); font-size: 0.9em; }
.herb-landing a { color: inherit; }


.herb-landing .hero { padding: clamp(3rem, 7vw, 5.5rem) 0 clamp(2.5rem, 5vw, 4rem); }
.herb-landing .hero-grid { display: grid; gap: 2rem; grid-template-columns: minmax(0, 1fr); align-items: center; }
@media (min-width: 58rem) {
  .herb-landing .hero-grid { grid-template-columns: minmax(0, 46rem) 17rem; gap: 3rem; justify-content: space-between; }
}
.herb-landing .hero-art { display: flex; justify-content: flex-start; order: -1; }
.herb-landing .hero-art img { width: clamp(7.5rem, 26vw, 15rem); height: auto; }
@media (min-width: 58rem) {
  .herb-landing .hero-art { justify-content: center; order: 0; }
}
.herb-landing .hero h1 {
  font-size: clamp(2.3rem, 5.6vw, 3.9rem); font-weight: 700;
  letter-spacing: -0.035em; max-width: 19ch; margin-bottom: 1.4rem;
}
.herb-landing .hero h1 em { font-style: normal; color: var(--accent); }
.herb-landing .hero-sub {
  font-size: clamp(1.05rem, 1.9vw, 1.25rem); color: var(--ink-soft);
  max-width: 50ch; margin: 0 0 1.25rem; line-height: 1.55;
}
.herb-landing .verbs { font-weight: 500; font-size: clamp(1.05rem, 2vw, 1.3rem); margin: 0 0 2.25rem; }
.herb-landing .verbs span { color: var(--ink-faint); }

.herb-landing .ships {
  display: flex; align-items: center; gap: 0.5rem;
  font-family: var(--mono); font-size: 0.8125rem; color: var(--accent);
  margin: 0 0 1.1rem;
}
.herb-landing .ships .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); flex: none; }

.herb-landing .cta-row { display: flex; flex-wrap: wrap; gap: 0.7rem; }
.herb-landing .btn {
  display: inline-block; font-weight: 600; font-size: 0.9375rem;
  padding: 0.68rem 1.25rem; border-radius: 3px; text-decoration: none;
  border: 1px solid transparent; transition: opacity 0.15s;
}
.herb-landing .btn-primary { background: var(--accent); color: var(--vp-c-white); }
.herb-landing .btn-secondary { border-color: var(--rule); color: var(--ink); }
.herb-landing .btn:hover { opacity: 0.85; }

.herb-landing .term, .herb-landing .diag {
  background: var(--term-bg); color: var(--term-fg);
  font-family: var(--mono); font-size: 0.8125rem; line-height: 1.75;
  border-radius: 5px; padding: 1.15rem 1.35rem; overflow-x: auto; margin: 0;
}
.herb-landing .term { white-space: pre; }
.herb-landing .diag p { margin: 0 0 1rem; }
.herb-landing .diag p:last-child { margin-bottom: 0; }
.herb-landing .diag-frame { margin: 0 0 1rem; white-space: pre; overflow-x: auto; font: inherit; line-height: 1.75; }
.herb-landing .diag-sep { display: flex; align-items: center; gap: 0.75rem; color: var(--term-dim); margin: 1.5rem 0 !important; }
.herb-landing .diag-sep::before { content: ""; flex: 1; border-top: 1px solid currentColor; opacity: 0.4; }
.herb-landing .diag-sep::after { content: ""; width: 2.5rem; border-top: 1px solid currentColor; opacity: 0.4; }

.herb-landing .dim { color: var(--term-dim); }
.herb-landing .g { color: var(--term-green); }
.herb-landing .b { color: var(--term-blue); }
.herb-landing .a { color: #d19a66; }
.herb-landing .bold { font-weight: 600; }
.herb-landing .tag { color: #e06c75; }
.herb-landing .attr { color: #d19a66; }
.herb-landing .eq { color: #56b6c2; }
.herb-landing .str { color: #98c379; }
.herb-landing .erb { color: #be5046; }
.herb-landing .warnq { color: #d9b063; }
.herb-landing .prev { opacity: 0.55; }
.herb-landing .rule { color: #8fb6d6; text-decoration: underline; text-underline-offset: 2px; }

.herb-landing .term-label {
  font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.01em;
  color: var(--ink-faint); margin: 0 0 0.55rem;
}
.herb-landing .hero-demo { margin-top: 3rem; max-width: 72rem; }

.herb-landing section { padding: clamp(3rem, 6.5vw, 5rem) 0; border-top: 1px solid var(--rule); }
.herb-landing .sec-head { margin-bottom: 2.5rem; }
.herb-landing .sec-head h2 { font-size: clamp(1.65rem, 3.4vw, 2.4rem); font-weight: 500; letter-spacing: -0.028em; max-width: 24ch; }
.herb-landing .sec-head p { color: var(--ink-soft); max-width: var(--measure); margin: 1rem 0 0; }

.herb-landing .split { display: grid; gap: 2rem; grid-template-columns: minmax(0, 1fr); align-items: start; }
@media (min-width: 58rem) { .herb-landing .split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3.25rem; } }

.herb-landing .caps { display: grid; gap: 2.5rem; }
.herb-landing .cap { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr); align-items: center; }
.herb-landing :is(.hero-grid, .split, .caps, .cap, .eco, .grid3, .orgs) > * { min-width: 0; }
@media (min-width: 58rem) {
  .herb-landing .cap { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2.75rem; }
  .herb-landing .cap:nth-child(even) > .cap-text { order: 2; }
}
.herb-landing .cap h3 { font-size: 1.1875rem; font-weight: 600; margin-bottom: 0.45rem; letter-spacing: -0.015em; }
.herb-landing .cap p { color: var(--ink-soft); font-size: 0.9688rem; margin: 0; }

.herb-landing .punch { font-weight: 500; font-size: clamp(1.4rem, 2.9vw, 1.95rem); letter-spacing: -0.022em; margin: 1.75rem 0 0; line-height: 1.2; }
.herb-landing .punch span { color: var(--accent); }

.herb-landing .eco { display: grid; gap: 2rem; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 52rem) { .herb-landing .eco { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2.5rem; } }
.herb-landing .eco-group h3 {
  font-family: var(--mono); font-size: 0.8125rem; font-weight: 500;
  letter-spacing: 0.01em; color: var(--ink-soft);
  padding-bottom: 0.7rem; margin-bottom: 0.2rem; border-bottom: 1px solid var(--rule);
}
.herb-landing .eco-when { font-family: var(--mono); font-size: 0.6875rem; letter-spacing: 0.06em; color: var(--ink-faint); margin: 0.7rem 0 0.2rem; }
.herb-landing .eco-group ul { list-style: none; padding: 0; margin: 0; }
.herb-landing .eco-group li {
  padding: 0.55rem 0; border-bottom: 1px solid var(--rule); font-size: 0.9375rem;
  display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap;
}
.herb-landing .eco-group li:last-child { border-bottom: none; }
.herb-landing .eco-group a { font-weight: 500; text-decoration: none; }
.herb-landing .eco-group a:hover { color: var(--accent); }
.herb-landing .eco-group em { font-style: normal; font-family: var(--mono); font-size: 0.6875rem; color: var(--ink-faint); letter-spacing: 0.04em; }

.herb-landing .grid3 { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); }
@media (min-width: 46rem) { .herb-landing .grid3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.herb-landing .tile { border: 1px solid var(--rule); border-radius: 4px; padding: 1.25rem 1.35rem; background: var(--surface); }
.herb-landing .tile h3 { font-size: 0.9688rem; font-weight: 600; margin-bottom: 0.35rem; }
.herb-landing .tile p { font-size: 0.875rem; color: var(--ink-soft); margin: 0; }

.herb-landing .pointer {
  background: var(--surface); border: 1px solid var(--rule);
  border-left: 3px solid var(--accent); border-radius: 4px; padding: 1.6rem 1.75rem;
}
.herb-landing .pointer h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.6rem; letter-spacing: -0.018em; }
.herb-landing .pointer p { color: var(--ink-soft); font-size: 0.9688rem; }
.herb-landing .pointer a { color: var(--accent); font-weight: 600; text-decoration: none; }
.herb-landing .pointer a:hover { text-decoration: underline; }

.herb-landing .grant {
  background: var(--accent-soft); border: 1px solid var(--accent-line);
  border-radius: 5px; padding: 0.9rem 1.1rem; margin-top: 1rem; max-width: var(--measure);
}
.herb-landing .grant p { margin: 0; font-size: 0.875rem; line-height: 1.6; color: var(--ink-soft); }
.herb-landing .grant-eyebrow {
  font-family: var(--mono); font-size: 0.6875rem; color: var(--accent);
  border: 1px solid var(--accent-line); border-radius: 3px; padding: 0.1rem 0.35rem; margin-right: 0.35rem;
}
.herb-landing .grant strong { color: var(--ink); font-weight: 600; }
.herb-landing .grant a { color: var(--accent); font-weight: 600; text-decoration: none; }
.herb-landing .grant a:hover { text-decoration: underline; }

.herb-landing .sponsor-label { font-family: var(--mono); font-size: 0.8125rem; color: var(--ink-faint); margin: 2.25rem 0 1rem; }
.herb-landing .orgs {
  display: grid; gap: 0.6rem; grid-template-columns: repeat(auto-fill, minmax(12.5rem, 1fr));
  list-style: none; padding: 0; margin: 0;
}
.herb-landing .orgs li { display: flex; }
.herb-landing .orgs a {
  display: flex; flex: 1; align-items: center; gap: 0.7rem; text-decoration: none;
  padding: 0.6rem 0.85rem; border: 1px solid var(--rule); border-radius: 6px;
  background: var(--surface); transition: border-color 0.15s;
}
.herb-landing .orgs a:hover { border-color: var(--accent-line); }
.herb-landing .orgs img { width: 28px; height: 28px; border-radius: 5px; flex: none; background: var(--sunk); }
.herb-landing .orgs span { font-size: 0.875rem; font-weight: 500; color: var(--ink); line-height: 1.25; }
.herb-landing .people { display: flex; flex-wrap: wrap; gap: 0.5rem; list-style: none; padding: 0; margin: 0; }
.herb-landing .people a { display: block; border-radius: 50%; transition: transform 0.15s; }
.herb-landing .people a:hover { transform: translateY(-2px); }
.herb-landing .people img { width: 40px; height: 40px; border-radius: 50%; display: block; background: var(--sunk); border: 1px solid var(--rule); }
.herb-landing .sponsor-why {
  margin-top: 0.9rem; color: var(--ink-soft); font-size: 0.9375rem; max-width: var(--measure);
}
.herb-landing .sponsor-why a { color: var(--accent); font-weight: 500; text-decoration: none; }
.herb-landing .sponsor-why a:hover { text-decoration: underline; }
.herb-landing .sponsor-note { margin-top: 2rem; color: var(--ink-soft); font-size: 0.9375rem; max-width: var(--measure); }
.herb-landing .sponsor-note a { color: var(--accent); font-weight: 600; text-decoration: none; }
.herb-landing .sponsor-note a:hover { text-decoration: underline; }

.herb-landing .closing { padding-bottom: 5rem; }
</style>

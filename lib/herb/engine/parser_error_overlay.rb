# frozen_string_literal: true

require_relative "highlighter_bridge"

module Herb
  class Engine
    class ParserErrorOverlay
      CONTEXT_LINES = 3

      OPEN_LIMIT = 3
      VISIBLE_LIMIT = 8

      TAB_WIDTH = 2

      ERROR_CLASS_PRIORITRY = [
        Herb::Errors::UnexpectedTokenError,
        Herb::Errors::UnexpectedError,
        Herb::Errors::RubyParseError,
        Herb::Errors::TagNamesMismatchError,
        Herb::Errors::VoidElementClosingTagError,
        Herb::Errors::UnclosedElementError,
        Herb::Errors::MissingClosingTagError,
        Herb::Errors::MissingOpeningTagError,
        Herb::Errors::MissingAttributeValueError
      ].freeze

      # Keep in sync with getEditorUrl in javascript/packages/dev-tools/src/herb-overlay.ts
      LINE_TOKEN = "__HERB_LINE__"
      COLUMN_TOKEN = "__HERB_COLUMN__"

      EDITOR_URL_TEMPLATES = {
        "atom" => "atom://core/open/file?filename=%<path>s&line=%<line>s&column=%<column>s",
        "cursor" => "cursor://file/%<path>s:%<line>s:%<column>s",
        "emacs" => "emacs://open?url=file://%<path>s&line=%<line>s&column=%<column>s",
        "idea" => "idea://open?file=%<path>s&line=%<line>s&column=%<column>s",
        "macvim" => "mvim://open?url=file://%<path>s&line=%<line>s&column=%<column>s",
        "nova" => "nova://open?path=%<path>s&line=%<line>s&column=%<column>s",
        "nvim" => "nvim://open?url=file://%<path>s&line=%<line>s&column=%<column>s",
        "rubymine" => "x-mine://open?file=%<path>s&line=%<line>s&column=%<column>s",
        "sublime" => "subl://open?url=file://%<path>s&line=%<line>s&column=%<column>s",
        "textmate" => "txmt://open?url=file://%<path>s&line=%<line>s&column=%<column>s",
        "vim" => "vim://open?url=file://%<path>s&line=%<line>s&column=%<column>s",
        "vscode" => "vscode://file/%<path>s:%<line>s:%<column>s",
        "vscodium" => "vscodium://file/%<path>s:%<line>s:%<column>s",
        "windsurf" => "windsurf://file/%<path>s:%<line>s:%<column>s",
        "zed" => "zed://file/%<path>s:%<line>s:%<column>s",
      }.freeze

      EDITOR_ALIASES = {
        "code" => "vscode",
        "code-insiders" => "vscode",
        "codium" => "vscodium",
        "subl" => "sublime",
        "mate" => "textmate",
        "mine" => "rubymine",
        "vi" => "vim",
        "gvim" => "vim",
      }.freeze

      CHROME_CSS = <<~CSS
        .herb-parser-error-overlay,
        .herb-parser-error-overlay *,
        .herb-parser-error-overlay *::before,
        .herb-parser-error-overlay *::after { box-sizing: border-box; }

        .herb-parser-error-overlay :where(h1, p, ul, ol, li, pre, code, figure, figcaption, summary, kbd) { margin: 0; padding: 0; }
        .herb-parser-error-overlay :where(ul, ol) { list-style: none; }

        .herb-parser-error-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 32px 20px;
          overflow-y: auto;
          overscroll-behavior: contain;
          background: rgba(6, 8, 11, 0.82);
          backdrop-filter: blur(6px);
          color: #e6e9ee;
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 14px;
          line-height: 1.55;
          -webkit-font-smoothing: antialiased;
          color-scheme: dark;

          --tpl-bg: #0b0d10;
          --tpl-surface: #111418;
          --tpl-surface-2: #161a20;
          --tpl-border: #232a33;
          --tpl-border-soft: rgba(148, 163, 184, 0.14);
          --tpl-text: #e6e9ee;
          --tpl-dim: #98a2b3;
          --tpl-faint: #6b7684;
          --tpl-danger: #f87171;
          --tpl-warn: #fbbf24;
          --tpl-fix: #34d399;
          --tpl-radius: 12px;
          --tpl-radius-sm: 8px;
          --tpl-mono: ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace;

          --herb-rule: #232a33;
          --herb-rule-label: #98a2b3;
          --herb-tooltip-bg: #161a20;
          --herb-line-number: #5b6673;
          --herb-file-header: #98a2b3;
          --herb-inline-code-bg: rgba(148, 163, 184, 0.16);
          --herb-severity-error: #f87171;
          --herb-severity-warning: #fbbf24;
          --herb-severity-info: #60a5fa;
          --herb-severity-hint: #94a3b8;
          --herb-marker-error-bg: rgba(248, 113, 113, 0.16);
          --herb-marker-warning-bg: rgba(251, 191, 36, 0.16);
          --herb-marker-info-bg: rgba(96, 165, 250, 0.16);
          --herb-marker-hint-bg: rgba(148, 163, 184, 0.14);
        }

        .herb-parser-error-overlay .herb-tpl-sheet {
          width: 100%;
          max-width: 1080px;
          margin: auto;
          background: var(--tpl-bg);
          border: 1px solid var(--tpl-border);
          border-radius: var(--tpl-radius);
          box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.7);
        }

        .herb-parser-error-overlay .herb-tpl-masthead {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 23px 28px 18px;
          border-top: 3px solid var(--tpl-danger);
          border-bottom: 1px solid var(--tpl-border);
          border-radius: var(--tpl-radius) var(--tpl-radius) 0 0;
          background: linear-gradient(180deg, rgba(248, 113, 113, 0.07), transparent 70%);
        }

        .herb-parser-error-overlay .herb-tpl-masthead-main { flex: 1; min-width: 0; }

        .herb-parser-error-overlay .herb-tpl-eyebrow {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--tpl-faint);
        }

        .herb-parser-error-overlay .herb-tpl-brand { color: var(--tpl-fix); font-weight: 600; text-transform: none; letter-spacing: 0.04em; }

        .herb-parser-error-overlay[data-herb-tpl-line-links] .herb-tpl-excerpt .herb-line-number {
          cursor: pointer;
          border-radius: 3px;
        }

        .herb-parser-error-overlay[data-herb-tpl-line-links] .herb-tpl-excerpt .herb-line-number:hover {
          color: var(--tpl-text);
          background: var(--tpl-surface-2);
        }

        .herb-parser-error-overlay[data-herb-tpl-line-links] .herb-tpl-excerpt .herb-line-number:focus-visible {
          outline: 2px solid var(--tpl-danger);
          outline-offset: 1px;
        }
        .herb-parser-error-overlay .herb-tpl-eyebrow-kind { font-family: var(--tpl-mono); text-transform: none; letter-spacing: 0; }

        .herb-parser-error-overlay .herb-tpl-title {
          margin-bottom: 6px;
          font-size: 22px;
          font-weight: 650;
          line-height: 1.25;
          letter-spacing: -0.01em;
          word-break: break-word;
        }

        .herb-parser-error-overlay .herb-tpl-lede { max-width: 80ch; font-size: 14.5px; color: var(--tpl-dim); }

        .herb-parser-error-overlay .herb-tpl-dismiss {
          flex: none;
          width: 30px;
          height: 30px;
          border: 1px solid transparent;
          border-radius: var(--tpl-radius-sm);
          background: transparent;
          color: var(--tpl-faint);
          font: inherit;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
        }
        .herb-parser-error-overlay .herb-tpl-dismiss:hover { background: var(--tpl-surface-2); color: var(--tpl-text); }

        .herb-parser-error-overlay .herb-tpl-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 14px 28px;
          border-bottom: 1px solid var(--tpl-border);
        }

        .herb-parser-error-overlay .herb-tpl-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border: 1px solid var(--tpl-border);
          border-radius: 999px;
          background: var(--tpl-surface);
          font-size: 12px;
          color: var(--tpl-dim);
          white-space: nowrap;
        }
        .herb-parser-error-overlay .herb-tpl-chip-file {
          font-family: var(--tpl-mono);
          color: var(--tpl-text);
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .herb-parser-error-overlay .herb-tpl-chip-phase { color: var(--tpl-faint); }
        .herb-parser-error-overlay .herb-tpl-chip-label { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tpl-faint); }

        .herb-parser-error-overlay .herb-tpl-glyph {
          padding: 1px 4px;
          border-radius: 3px;
          background: #2f6f3e;
          color: #fff;
          font-family: inherit;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }

        .herb-parser-error-overlay .herb-tpl-code {
          padding: 0 0.3em;
          border-radius: 3px;
          background: rgba(148, 163, 184, 0.16);
          color: var(--tpl-text);
          font-family: var(--tpl-mono);
          font-size: 12px;
        }

        .herb-parser-error-overlay .herb-tpl-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; }
        .herb-parser-error-overlay .herb-tpl-dot-error { background: var(--tpl-danger); }
        .herb-parser-error-overlay .herb-tpl-dot-warning { background: var(--tpl-warn); }

        .herb-parser-error-overlay .herb-tpl-body { padding: 20px 28px; }
        .herb-parser-error-overlay .herb-tpl-list { display: flex; flex-direction: column; gap: 14px; }

        .herb-parser-error-overlay .herb-tpl-item {
          position: relative;
          background: var(--tpl-surface);
          border: 1px solid var(--tpl-border);
          border-left: 3px solid var(--tpl-danger);
          border-radius: var(--tpl-radius-sm);
        }
        .herb-parser-error-overlay .herb-tpl-item[data-herb-tpl-severity="warning"] { border-left-color: var(--tpl-warn); }

        .herb-parser-error-overlay .herb-tpl-tools {
          position: absolute;
          top: 8px;
          right: 10px;
          display: flex;
          gap: 4px;
        }

        .herb-parser-error-overlay .herb-tpl-tool {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 28px;
          padding: 0 9px;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: var(--tpl-dim);
          font: inherit;
          font-family: var(--tpl-mono);
          font-size: 11.5px;
          text-decoration: none;
          cursor: pointer;
        }
        .herb-parser-error-overlay a.herb-tpl-tool:hover,
        .herb-parser-error-overlay button.herb-tpl-tool:hover {
          background: var(--tpl-surface-2);
          border-color: var(--tpl-border);
          color: var(--tpl-text);
        }
        .herb-parser-error-overlay .herb-tpl-tool-static { cursor: default; opacity: 0.7; }

        .herb-parser-error-overlay .herb-tpl-card-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 9px;
          min-height: 44px;
          padding: 10px 150px 10px 17px;
          border-radius: var(--tpl-radius-sm);
          list-style: none;
          cursor: pointer;
          font-size: 13px;
          user-select: none;
        }
        .herb-parser-error-overlay .herb-tpl-card-head::-webkit-details-marker { display: none; }
        .herb-parser-error-overlay .herb-tpl-card-head::marker { content: ""; }
        .herb-parser-error-overlay .herb-tpl-card-head:hover { background: var(--tpl-surface-2); }
        .herb-parser-error-overlay .herb-tpl-card[open] > .herb-tpl-card-head {
          border-bottom: 1px solid var(--tpl-border);
          border-radius: var(--tpl-radius-sm) var(--tpl-radius-sm) 0 0;
        }

        .herb-parser-error-overlay .herb-tpl-chevron,
        .herb-parser-error-overlay .herb-tpl-more-chevron {
          flex: none;
          color: var(--tpl-faint);
          font-size: 14px;
          line-height: 1;
          transition: transform 0.18s ease;
        }
        .herb-parser-error-overlay details[open] > summary .herb-tpl-chevron,
        .herb-parser-error-overlay details[open] > summary .herb-tpl-more-chevron { transform: rotate(90deg); }

        .herb-parser-error-overlay .herb-tpl-rank {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          border-radius: 5px;
          background: rgba(148, 163, 184, 0.14);
          color: var(--tpl-dim);
          font-family: var(--tpl-mono);
          font-size: 11px;
          font-variant-numeric: tabular-nums;
        }
        .herb-parser-error-overlay .herb-tpl-name { font-weight: 600; }

        .herb-parser-error-overlay .herb-tpl-badge-start {
          padding: 1px 8px;
          border: 1px solid currentColor;
          border-radius: 999px;
          color: var(--tpl-danger);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .herb-parser-error-overlay .herb-tpl-repeat {
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.14);
          color: var(--tpl-dim);
          font-size: 11px;
        }

        .herb-parser-error-overlay .herb-tpl-panel { padding: 12px 14px 14px 17px; }

        .herb-parser-error-overlay .herb-tpl-fix {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          padding: 10px 12px;
          border: 1px solid rgba(52, 211, 153, 0.28);
          border-left: 3px solid var(--tpl-fix);
          border-radius: var(--tpl-radius-sm);
          background: rgba(52, 211, 153, 0.07);
          font-size: 12.5px;
        }
        .herb-parser-error-overlay .herb-tpl-fix-label {
          flex: none;
          padding-top: 2px;
          color: var(--tpl-fix);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .herb-parser-error-overlay .herb-tpl-fix-body { min-width: 0; overflow-wrap: anywhere; }
        .herb-parser-error-overlay .herb-tpl-fix-title { color: var(--tpl-fix); font-weight: 600; }
        .herb-parser-error-overlay .herb-tpl-fix-text { color: var(--tpl-dim); }
        .herb-parser-error-overlay .herb-tpl-fix-generic {
          border-color: var(--tpl-border-soft);
          border-left-color: var(--tpl-faint);
          background: rgba(148, 163, 184, 0.06);
        }
        .herb-parser-error-overlay .herb-tpl-fix-generic .herb-tpl-fix-label,
        .herb-parser-error-overlay .herb-tpl-fix-generic .herb-tpl-fix-title { color: var(--tpl-faint); }
        .herb-parser-error-overlay .herb-tpl-fix-seen { padding: 6px 12px; background: transparent; opacity: 0.55; }

        .herb-parser-error-overlay .herb-tpl-excerpt {
          padding: 12px 14px;
          border: 1px solid var(--tpl-border-soft);
          border-radius: var(--tpl-radius-sm);
          background: var(--tpl-bg);
          overflow: visible;
          font-size: 12.5px;
          line-height: 1.65;
          tab-size: 2;
        }
        .herb-parser-error-overlay .herb-tpl-excerpt pre,
        .herb-parser-error-overlay .herb-tpl-excerpt code {
          font-family: var(--tpl-mono);
          font-size: inherit;
          line-height: inherit;
        }

        .herb-parser-error-overlay .herb-tpl-plain-head { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
        .herb-parser-error-overlay .herb-tpl-plain-msg { min-width: 0; overflow-wrap: anywhere; }
        .herb-parser-error-overlay .herb-tpl-sev { font-weight: 700; }
        .herb-parser-error-overlay .herb-tpl-sev-error { color: var(--herb-severity-error); }
        .herb-parser-error-overlay .herb-tpl-sev-warning { color: var(--herb-severity-warning); }
        .herb-parser-error-overlay .herb-tpl-plain-code,
        .herb-parser-error-overlay .herb-tpl-plain-file { color: var(--tpl-dim); opacity: 0.85; }
        .herb-parser-error-overlay .herb-tpl-plain-file { margin-bottom: 10px; }
        .herb-parser-error-overlay .herb-tpl-pre { white-space: pre-wrap; overflow-wrap: anywhere; }
        .herb-parser-error-overlay .herb-tpl-row { color: var(--tpl-text); }
        .herb-parser-error-overlay .herb-tpl-row::before {
          content: attr(data-line);
          display: inline-block;
          width: 3ch;
          margin-right: 1ch;
          text-align: right;
          color: var(--herb-line-number);
          user-select: none;
        }
        .herb-parser-error-overlay .herb-tpl-row-dim { opacity: 0.6; }
        .herb-parser-error-overlay .herb-tpl-row-marked::before { color: var(--tpl-danger); font-weight: 700; }
        .herb-parser-error-overlay .herb-tpl-caret {
          margin-left: 4ch;
          color: var(--tpl-danger);
          font-weight: 700;
          white-space: pre-wrap;
        }

        .herb-parser-error-overlay .herb-tpl-more {
          margin-top: 14px;
          border: 1px dashed var(--tpl-border);
          border-radius: var(--tpl-radius-sm);
        }
        .herb-parser-error-overlay .herb-tpl-more-head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          list-style: none;
          cursor: pointer;
          font-size: 12.5px;
          color: var(--tpl-dim);
          user-select: none;
        }
        .herb-parser-error-overlay .herb-tpl-more-head::-webkit-details-marker { display: none; }
        .herb-parser-error-overlay .herb-tpl-more-head::marker { content: ""; }
        .herb-parser-error-overlay .herb-tpl-more-head:hover { color: var(--tpl-text); }
        .herb-parser-error-overlay .herb-tpl-more-show,
        .herb-parser-error-overlay .herb-tpl-more-hide { font-weight: 600; color: var(--tpl-text); }
        .herb-parser-error-overlay .herb-tpl-more-hide { display: none; }
        .herb-parser-error-overlay .herb-tpl-more[open] .herb-tpl-more-show { display: none; }
        .herb-parser-error-overlay .herb-tpl-more[open] .herb-tpl-more-hide { display: inline; }
        .herb-parser-error-overlay .herb-tpl-more-hint { margin-left: auto; color: var(--tpl-faint); }
        .herb-parser-error-overlay .herb-tpl-list-rest { padding: 4px 14px 14px; }

        .herb-parser-error-overlay .herb-tpl-footer { padding: 14px 28px 20px; border-top: 1px solid var(--tpl-border); }
        .herb-parser-error-overlay .herb-tpl-note { max-width: 90ch; margin-bottom: 6px; font-size: 12px; color: var(--tpl-faint); }
        .herb-parser-error-overlay .herb-tpl-footer-meta {
          display: flex;
          gap: 14px;
          font-family: var(--tpl-mono);
          font-size: 11px;
          color: var(--tpl-faint);
        }
        .herb-parser-error-overlay .herb-tpl-kbd {
          padding: 1px 5px;
          border: 1px solid var(--tpl-border);
          border-radius: 4px;
          background: var(--tpl-surface);
          font-family: var(--tpl-mono);
          font-size: 10.5px;
        }

        .herb-parser-error-overlay .herb-tpl-sr {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }

        .herb-parser-error-overlay [hidden] { display: none; }

        .herb-parser-error-overlay :where(a, button, summary):focus-visible {
          outline: 2px solid var(--herb-severity-info);
          outline-offset: 2px;
          border-radius: 4px;
        }

        @media (prefers-reduced-motion: reduce) {
          .herb-parser-error-overlay .herb-tpl-chevron,
          .herb-parser-error-overlay .herb-tpl-more-chevron { transition: none; }
        }

        @media (max-width: 820px) {
          .herb-parser-error-overlay { padding: 12px; }
          .herb-parser-error-overlay .herb-tpl-masthead { padding: 17px 16px 14px; }
          .herb-parser-error-overlay .herb-tpl-title { font-size: 19px; }
          .herb-parser-error-overlay .herb-tpl-meta { padding: 12px 16px; }
          .herb-parser-error-overlay .herb-tpl-body { padding: 14px 16px; }
          .herb-parser-error-overlay .herb-tpl-footer { padding: 12px 16px 16px; }
          .herb-parser-error-overlay .herb-tpl-card-head { padding-right: 76px; }
          .herb-parser-error-overlay .herb-tpl-tool-text { display: none; }
          .herb-parser-error-overlay .herb-tpl-more-hint { display: none; }
          .herb-parser-error-overlay .herb-tpl-excerpt { padding: 10px; font-size: 12px; }
        }
      CSS

      CHROME_JS = <<~JS
        (function () {
          var root = (document.currentScript && document.currentScript.closest(".herb-parser-error-overlay"))
                  || document.querySelector(".herb-parser-error-overlay");

          if (!root || root.dataset.herbTplReady) return;
          root.dataset.herbTplReady = "1";

          root.querySelectorAll("[hidden][data-herb-tpl-copy], [hidden][data-herb-tpl-dismiss], [hidden][data-herb-tpl-esc]")
              .forEach(function (el) { el.removeAttribute("hidden"); });

          if (document.body.dataset.herbTplPreviousOverflow === undefined) {
            document.body.dataset.herbTplPreviousOverflow = document.body.style.overflow;
          }

          document.body.style.overflow = "hidden";

          function dismiss() {
            document.body.style.overflow = document.body.dataset.herbTplPreviousOverflow || "";
            delete document.body.dataset.herbTplPreviousOverflow;
            document.removeEventListener("keydown", onKey, true);
            root.remove();
          }

          function onKey(event) {
            if (event.key === "Escape") { event.stopPropagation(); dismiss(); }
          }

          document.addEventListener("keydown", onKey, true);

          root.addEventListener("click", function (event) {
            if (event.target === root || event.target.closest("[data-herb-tpl-dismiss]")) { dismiss(); return; }

            var button = event.target.closest("[data-herb-tpl-copy]");
            if (!button) return;

            event.preventDefault();

            var glyph = button.querySelector(".herb-tpl-tool-glyph");
            var restore = glyph ? glyph.textContent : null;

            function done() {
              if (!glyph) return;
              glyph.textContent = "✓";
              setTimeout(function () { glyph.textContent = restore; }, 1000);
            }

            var text = button.getAttribute("data-herb-tpl-copy");

            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(text).then(done, function () {});
            }
          });

          var editorTemplate = root.getAttribute("data-herb-tpl-editor-template");

          if (editorTemplate) {
            var numbers = root.querySelectorAll(".herb-tpl-excerpt .herb-line-number[data-line]");

            numbers.forEach(function (number) {
              number.setAttribute("role", "button");
              number.setAttribute("tabindex", "0");
              number.setAttribute("title", "Open line " + number.getAttribute("data-line") + " in editor");
            });

            if (numbers.length > 0) root.dataset.herbTplLineLinks = "1";

            function openLine(number) {
              var line = number.getAttribute("data-line");

              if (!line) return;

              window.location.href = editorTemplate
                .split("__HERB_LINE__").join(line)
                .split("__HERB_COLUMN__").join("1");
            }

            root.addEventListener("click", function (event) {
              var number = event.target.closest(".herb-tpl-excerpt .herb-line-number[data-line]");

              if (!number) return;

              event.preventDefault();
              openLine(number);
            });

            root.addEventListener("keydown", function (event) {
              if (event.key !== "Enter" && event.key !== " ") return;

              var number = event.target.closest(".herb-tpl-excerpt .herb-line-number[data-line]");

              if (!number) return;

              event.preventDefault();
              openLine(number);
            });
          }

          var sheet = root.querySelector(".herb-tpl-sheet");
          if (sheet) sheet.focus({ preventScroll: true });
        })();
      JS

      def initialize(source, errors, filename: nil, overlay_messages: "both", bridge: nil, project_path: nil) # rubocop:disable Metrics/ParameterLists
        @source = source
        @errors = errors.sort_by { |error|
          [ERROR_CLASS_PRIORITRY.index(error.class) || -1, line_of(error), column_of(error)]
        }
        @filename = filename || "unknown"
        @lines = source.lines
        @overlay_messages = overlay_messages
        @bridge = bridge || HighlighterBridge.new
        @project_path = project_path
      end

      def generate_html
        return "" if @errors.empty?

        <<~HTML
          <div class="herb-parser-error-overlay"#{editor_template_attribute}>
            <style>
              #{stylesheet_block}
            </style>

            <div class="herb-tpl-sheet" role="dialog" aria-modal="true" aria-labelledby="herb-tpl-title" tabindex="-1">
              #{masthead_html}
              #{meta_html}
              #{body_html}
              #{footer_html}
            </div>

            <script>
              #{CHROME_JS}
            </script>
          </div>
        HTML
      end

      private

      def stylesheet_block
        parts = [] #: Array[String]

        parts << @bridge.stylesheet.to_s if bridge_fragments.any?
        parts << CHROME_CSS

        parts.join("\n")
      end

      def masthead_html
        primary = groups.first

        <<~HTML
          <header class="herb-tpl-masthead">
            <div class="herb-tpl-masthead-main">
              <p class="herb-tpl-eyebrow">
                <span class="herb-tpl-brand">Herb</span>
                <span class="herb-tpl-eyebrow-sep" aria-hidden="true">/</span>
                <span class="herb-tpl-eyebrow-kind">#{escape_html(primary[:error_name])}</span>
              </p>
              <h1 class="herb-tpl-title" id="herb-tpl-title">#{escape_html(primary[:name])}</h1>
              <p class="herb-tpl-lede">#{escape_html(primary[:message])}</p>
            </div>
            <button type="button" class="herb-tpl-dismiss" data-herb-tpl-dismiss aria-label="Dismiss overlay" hidden>×</button>
          </header>
        HTML
      end

      def meta_html
        error_count = groups.count { |group| group[:severity] == "error" }
        warning_count = groups.count { |group| group[:severity] == "warning" }
        line_count = groups.map { |group| group[:line] }.uniq.length
        render_name = partial_render_name

        chips = [] #: Array[String]

        chips << %(<li class="herb-tpl-chip herb-tpl-chip-file"><span class="herb-tpl-glyph" aria-hidden="true">ERB</span>#{escape_html(@filename)}</li>)
        chips << %(<li class="herb-tpl-chip">#{escape_html(file_role)}</li>)

        if render_name
          chips << %(<li class="herb-tpl-chip"><span class="herb-tpl-chip-label">renders as</span><code class="herb-tpl-code">#{escape_html(render_name)}</code></li>)
        end

        if error_count.positive?
          chips << %(<li class="herb-tpl-chip"><span class="herb-tpl-dot herb-tpl-dot-error" aria-hidden="true"></span>#{error_count.to_i} #{pluralize(error_count, "error")}</li>)
        end

        if warning_count.positive?
          chips << %(<li class="herb-tpl-chip"><span class="herb-tpl-dot herb-tpl-dot-warning" aria-hidden="true"></span>#{warning_count.to_i} #{pluralize(warning_count, "warning")}</li>)
        end

        if groups.length > 1
          chips << %(<li class="herb-tpl-chip">#{line_count.to_i} #{pluralize(line_count, "line")} affected</li>)
        end
        chips << %(<li class="herb-tpl-chip herb-tpl-chip-phase">compile time</li>)

        %(<ul class="herb-tpl-meta">\n#{chips.join("\n")}\n</ul>)
      end

      def body_html
        items = item_htmls
        visible = items.first(VISIBLE_LIMIT)
        rest = items.drop(VISIBLE_LIMIT)

        html = %(<div class="herb-tpl-body">\n<ol class="herb-tpl-list">\n#{visible.join("\n")}\n</ol>\n)

        if rest.any?
          html << <<~HTML
            <details class="herb-tpl-more">
              <summary class="herb-tpl-more-head">
                <span class="herb-tpl-more-chevron" aria-hidden="true">›</span>
                <span class="herb-tpl-more-show">Show #{rest.length.to_i} more #{pluralize(rest.length, "diagnostic")}</span>
                <span class="herb-tpl-more-hide">Hide #{rest.length.to_i} #{pluralize(rest.length, "diagnostic")}</span>
                <span class="herb-tpl-more-hint">later errors often cascade from the first</span>
              </summary>
              <ol class="herb-tpl-list herb-tpl-list-rest" start="#{VISIBLE_LIMIT + 1}">
                #{rest.join("\n")}
              </ol>
            </details>
          HTML
        end

        html << "</div>"
        html
      end

      def footer_html
        <<~HTML
          <footer class="herb-tpl-footer">
            <p class="herb-tpl-note">Herb found these while compiling #{escape_html(@filename)}, before the template rendered. There is no render stack or partial caller chain at compile time, so every card above is a separate diagnostic from the same compile pass, ordered by Herb&#39;s error priority.</p>
            <p class="herb-tpl-footer-meta">
              <span class="herb-tpl-source">herb-compiler</span>
              <span class="herb-tpl-esc" data-herb-tpl-esc hidden>Press <kbd class="herb-tpl-kbd">Esc</kbd> to dismiss</span>
            </p>
          </footer>
        HTML
      end

      def item_htmls
        @item_htmls ||= begin
          seen = {} #: Hash[String, bool]

          groups.each_with_index.map { |group, index| render_item(group, index + 1, seen) }
        end
      end

      def render_item(group, rank, seen)
        severity = group[:severity]
        line = group[:line].to_i
        column = group[:column].to_i
        count = group[:count].to_i

        badges = [] #: Array[String]
        badges << %(<span class="herb-tpl-badge-start">start here</span>) if rank == 1 && groups.length > 1
        badges << %(<span class="herb-tpl-repeat">×#{count}</span>) if count > 1

        open_attribute = rank <= OPEN_LIMIT ? " open" : ""

        <<~HTML
          <li class="herb-tpl-item" data-herb-tpl-severity="#{escape_attr(severity)}">
            #{tools_html(line, column)}
            <details class="herb-tpl-card"#{open_attribute}>
              <summary class="herb-tpl-card-head">
                <span class="herb-tpl-chevron" aria-hidden="true">›</span>
                <span class="herb-tpl-dot herb-tpl-dot-#{escape_attr(severity)}" aria-hidden="true"></span>
                <span class="herb-tpl-sr">#{escape_html(severity)}</span>
                <span class="herb-tpl-rank">#{rank.to_i}</span>
                <span class="herb-tpl-name">#{escape_html(group[:name])}</span>
                <code class="herb-tpl-code">#{escape_html(group[:code])}</code>
                #{badges.join("\n")}
              </summary>

              <div class="herb-tpl-panel">
                #{fix_html(group, seen)}
                <div class="herb-tpl-excerpt">#{excerpt_html(group)}</div>
              </div>
            </details>
          </li>
        HTML
      end

      def tools_html(line, column)
        href = editor_href(line, column)

        primary = if href
                    %(<a class="herb-tpl-tool" href="#{escape_attr(href)}" title="Open in editor" data-herb-tpl-open data-herb-tpl-file="#{escape_attr(@filename)}" data-herb-tpl-line="#{line.to_i}" data-herb-tpl-column="#{column.to_i}" rel="noopener"><span class="herb-tpl-tool-text">#{line.to_i}:#{column.to_i}</span><span class="herb-tpl-tool-glyph" aria-hidden="true">↗</span></a>)
                  else
                    %(<span class="herb-tpl-tool herb-tpl-tool-static"><span class="herb-tpl-tool-text">#{line.to_i}:#{column.to_i}</span></span>)
                  end

        copy_payload = escape_attr("#{@filename}:#{line.to_i}:#{column.to_i}")
        copy = %(<button type="button" class="herb-tpl-tool herb-tpl-copy" data-herb-tpl-copy="#{copy_payload}" aria-label="Copy location" hidden><span class="herb-tpl-tool-glyph" aria-hidden="true">⧉</span></button>)

        %(<div class="herb-tpl-tools">#{primary}#{copy}</div>)
      end

      def fix_html(group, seen)
        suggestion = group[:suggestion].to_s
        already_seen = seen.key?(suggestion)
        seen[suggestion] = true

        title, description = suggestion.split(": ", 2)
        title ||= "Suggestion"
        description ||= suggestion

        classes = ["herb-tpl-fix"] #: Array[String]
        classes << "herb-tpl-fix-generic" if suggestion.start_with?("Fix error: ")
        classes << "herb-tpl-fix-seen" if already_seen

        body = %(<p class="herb-tpl-fix-title">#{escape_html(title)}</p>)
        body << %(\n<p class="herb-tpl-fix-text">#{escape_html(description)}</p>) unless already_seen

        <<~HTML
          <div class="#{classes.join(" ")}">
            <span class="herb-tpl-fix-label" aria-hidden="true">Fix</span>
            <div class="herb-tpl-fix-body">
              #{body}
            </div>
          </div>
        HTML
      end

      def excerpt_html(group)
        bridge_fragments[group[:index]] || fallback_html(group)
      end

      def fallback_html(group)
        line = group[:line].to_i
        column = group[:column].to_i

        <<~HTML
          <div class="herb-tpl-plain">
            <p class="herb-tpl-plain-head">
              <span class="herb-tpl-sev herb-tpl-sev-#{escape_attr(group[:severity])}">#{escape_html(group[:severity])}</span>
              <span class="herb-tpl-plain-msg">#{escape_html(group[:message])}</span>
              <span class="herb-tpl-plain-code">(#{escape_html(group[:code])})</span>
            </p>
            <p class="herb-tpl-plain-file">#{escape_html(@filename)}:#{line}:#{column}</p>
            <pre class="herb-tpl-pre"><code>#{fallback_rows(group, line, column)}</code></pre>
          </div>
        HTML
      end

      def fallback_rows(group, line, column)
        start_line = [line - CONTEXT_LINES, 1].max
        end_line = [line + CONTEXT_LINES, @lines.length].min

        rows = [] #: Array[String]

        (start_line..end_line).each do |number|
          content = @lines[number - 1].to_s.chomp
          row_class = number == line ? "herb-tpl-row herb-tpl-row-marked" : "herb-tpl-row herb-tpl-row-dim"

          rows << %(<span class="#{row_class}" data-line="#{number.to_i}">#{escape_html(content)}</span>)

          next unless number == line && column.positive?

          rows << %(<span class="herb-tpl-caret">#{escape_html(caret_for(content, column, get_inline_hint(group[:error])))}</span>)
        end

        rows.join("\n")
      end

      def caret_for(content, column, hint)
        pad = expand_tabs(content[0, column - 1].to_s).length
        tail = expand_tabs(content[(column - 1)..].to_s).length
        caret = "#{" " * pad}^#{"~" * [tail - 1, 0].max}"

        hint ? "#{caret} #{hint}" : caret
      end

      def expand_tabs(text)
        text.gsub("\t", " " * TAB_WIDTH)
      end

      def groups
        @groups ||= begin
          entries = @errors.each_with_index.map do |error, index|
            {
              index: index,
              error: error,
              message: error.respond_to?(:message) ? error.message : error.to_s,
              error_name: error.error_name,
              code: error.error_name.sub(/Error\z/, ""),
              name: humanize(error.error_name),
              severity: severity_for(error),
              line: line_of(error),
              column: column_of(error),
              suggestion: get_error_suggestion(error),
            }
          end

          entries
            .group_by { |entry| [entry[:code], entry[:line], entry[:column], entry[:message]] }
            .values
            .map { |members| members.first.merge(count: members.length) }
        end
      end

      def bridge_fragments
        @bridge_fragments ||= @bridge.html_fragments(
          source: @source,
          errors: @errors,
          filename: @filename,
          context_lines: CONTEXT_LINES,
          messages: @overlay_messages,
          markers: "spans",
          line_numbers: "element"
        )
      end

      def severity_for(error)
        error.is_a?(Herb::Errors::RubyParseError) && error.level != "error" ? "warning" : "error"
      end

      def line_of(error)
        location = error.respond_to?(:location) ? error.location : nil

        location.is_a?(Herb::Location) && location.start ? location.start.line : 1
      end

      def column_of(error)
        location = error.respond_to?(:location) ? error.location : nil

        location.is_a?(Herb::Location) && location.start ? location.start.column : 1
      end

      def humanize(name)
        name.sub(/Error\z/, "")
            .gsub(/([A-Z]+)([A-Z][a-z])/, '\1 \2')
            .gsub(/([a-z\d])([A-Z])/, '\1 \2')
            .split
            .each_with_index
            .map { |word, index| index.zero? || word == word.upcase ? word : word.downcase }
            .join(" ")
      end

      def pluralize(count, word)
        count == 1 ? word : "#{word}s"
      end

      def file_role
        base = File.basename(@filename)

        return "layout" if @filename.start_with?("app/views/layouts/")
        return "component" if @filename.start_with?("app/components/") || base.end_with?("_component.html.erb")
        return "partial" if base.start_with?("_")
        return "view" if @filename.start_with?("app/views/")

        "template"
      end

      def partial_render_name
        return nil unless file_role == "partial" && @filename.start_with?("app/views/")

        relative = @filename.delete_prefix("app/views/")
        directory = File.dirname(relative)
        name = File.basename(relative).sub(/\A_/, "").sub(/\..*\z/, "")

        directory == "." ? name : File.join(directory, name)
      end

      def editor_key
        raw = (ENV.fetch("HERB_EDITOR", nil) || ENV.fetch("RAILS_EDITOR", nil) || ENV.fetch("EDITOR", nil)).to_s.strip.split(/\s/).first.to_s
        key = File.basename(raw).downcase

        return key if EDITOR_URL_TEMPLATES.key?(key)

        EDITOR_ALIASES[key] || "vscode"
      end

      def absolute_path
        return nil if @filename == "unknown"
        return @filename if @filename.start_with?("/")
        return nil unless @project_path

        File.join(@project_path.to_s, @filename)
      end

      def editor_href(line, column)
        path = absolute_path

        return nil unless path

        format(EDITOR_URL_TEMPLATES.fetch(editor_key), path: path, line: line.to_i, column: column.to_i)
      end

      def editor_href_template
        path = absolute_path

        return nil unless path

        format(EDITOR_URL_TEMPLATES.fetch(editor_key), path: path, line: LINE_TOKEN, column: COLUMN_TOKEN)
      end

      def editor_template_attribute
        template = editor_href_template

        return "" unless template

        %( data-herb-tpl-editor-template="#{escape_attr(template)}")
      end

      def get_error_suggestion(error)
        case error
        when Herb::Errors::MissingClosingTagError
          if error.respond_to?(:opening_tag) && error.opening_tag
            "Add missing closing tag: Add </#{error.opening_tag.value}> to close the opening tag"
          else
            "Add missing closing tag: Add the missing closing tag"
          end
        when Herb::Errors::MissingOpeningTagError
          if error.respond_to?(:closing_tag) && error.closing_tag
            "Add missing opening tag: Add <#{error.closing_tag.value}> before the closing tag"
          else
            "Add missing opening tag: Add the missing opening tag"
          end
        when Herb::Errors::TagNamesMismatchError
          if error.respond_to?(:opening_tag) && error.respond_to?(:closing_tag) && error.opening_tag && error.closing_tag
            "Fix tag mismatch: Change </#{error.closing_tag.value}> to </#{error.opening_tag.value}>"
          else
            "Fix tag mismatch: Ensure opening and closing tags match"
          end
        when Herb::Errors::VoidElementClosingTagError
          if error.respond_to?(:tag_name) && error.tag_name
            "Remove illegal closing tag: Remove the closing tag for void element <#{error.tag_name.value}>"
          else
            "Remove illegal closing tag: Remove the closing tag for this void element"
          end
        when Herb::Errors::UnclosedElementError
          if error.respond_to?(:opening_tag) && error.opening_tag
            "Close unclosed element: Add </#{error.opening_tag.value}> before the end of the template"
          else
            "Close unclosed element: Close the unclosed element"
          end
        when Herb::Errors::RubyParseError
          "Fix Ruby syntax: Check your Ruby syntax inside the ERB tag"
        when Herb::Errors::MissingAttributeValueError
          if error.respond_to?(:attribute_name) && error.attribute_name
            "Add attribute value: Add a value after the equals sign for '#{error.attribute_name}' or remove the equals sign"
          else
            "Add attribute value: Add a value after the equals sign or remove the equals sign"
          end
        else
          message = error.respond_to?(:message) ? error.message : error.to_s
          "Fix error: #{message}"
        end
      end

      def get_inline_hint(error)
        case error
        when Herb::Errors::MissingClosingTagError
          "← Missing closing tag"
        when Herb::Errors::TagNamesMismatchError
          "← Tag mismatch"
        when Herb::Errors::UnclosedElementError
          "← Unclosed element"
        when Herb::Errors::VoidElementClosingTagError
          "← Void element cannot be closed"
        when Herb::Errors::RubyParseError
          "← Ruby syntax error"
        when Herb::Errors::MissingAttributeValueError
          "← Missing attribute value"
        end
      end

      def escape_html(text)
        text.to_s
            .gsub("&", "&amp;")
            .gsub("<", "&lt;")
            .gsub(">", "&gt;")
            .gsub('"', "&quot;")
            .gsub("'", "&#39;")
      end

      def escape_attr(text)
        escape_html(text).gsub("\n", "&#10;").gsub("\r", "&#13;").gsub("\t", "&#9;")
      end
    end
  end
end

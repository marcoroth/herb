/**
 * The chrome around the highlighter fragments in an HTML report.
 *
 * Every class here is namespaced under `herb-report-` so that no selector can
 * ever reach into a highlighter fragment, whose classes all live under other
 * `herb-` names. The custom properties on `.herb-report-root` are the ones the
 * fragment stylesheet consumes with a fallback and never defines itself.
 */
export const REPORT_STYLESHEET = `:root {
  color-scheme: dark light;
}

.herb-report-page {
  margin: 0;
  padding: 0;
  background-color: #16181D;
  color: #C8CCD4;
  font-family: ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
}

.herb-report-root {
  --herb-report-surface: #1C1F26;
  --herb-report-surface-raised: #21252E;
  --herb-report-border: #2E333D;
  --herb-report-muted: #8A929F;
  --herb-report-accent: #61AFEF;

  --herb-rule: #2E333D;
  --herb-rule-label: #8A929F;
  --herb-rule-label-bg: #16181D;
  --herb-tooltip-bg: #21252E;
  --herb-inline-code-bg: rgba(160, 170, 190, 0.16);
  --herb-line-number: #666E7C;
  --herb-line-number-focus: #61AFEF;
  --herb-file-header: #61AFEF;
  --herb-severity-error: #F14C4C;
  --herb-severity-warning: #E5C07B;
  --herb-severity-info: #56B6C2;
  --herb-severity-hint: #8A929F;
  --herb-marker-error-bg: rgba(241, 76, 76, 0.16);
  --herb-marker-warning-bg: rgba(229, 192, 123, 0.16);
  --herb-marker-info-bg: rgba(86, 182, 194, 0.16);
  --herb-marker-hint-bg: rgba(138, 146, 159, 0.16);
  --herb-diff-added-number: #98C379;

  box-sizing: border-box;
  display: block;
  max-width: 68rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}

.herb-report-stat,
.herb-report-notice,
.herb-report-rule,
.herb-report-file,
.herb-report-card,
.herb-report-chain,
.herb-report-fix,
.herb-report-excerpt,
.herb-report-frame-excerpt,
.herb-report-fix-diff {
  box-sizing: border-box;
}

.herb-report-masthead {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--herb-report-border);
}

.herb-report-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.herb-report-project,
.herb-report-version {
  margin: 0.35rem 0 0;
  color: var(--herb-report-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.herb-report-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
}

.herb-report-stat {
  flex: 1 1 8rem;
  padding: 0.6rem 0.85rem;
  border: 1px solid var(--herb-report-border);
  border-radius: 8px;
  background-color: var(--herb-report-surface);
}

.herb-report-stat-value {
  display: block;
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.2;
}

.herb-report-stat-label {
  display: block;
  margin-top: 0.15rem;
  color: var(--herb-report-muted);
  font-size: 0.78rem;
}

.herb-report-notice {
  margin: 2rem 0 0;
  padding: 1.5rem;
  border: 1px solid var(--herb-report-border);
  border-radius: 10px;
  background-color: var(--herb-report-surface);
  text-align: center;
}

.herb-report-rail {
  margin-top: 2rem;
}

.herb-report-rail-title,
.herb-report-chain-title {
  margin: 0 0 0.6rem;
  color: var(--herb-report-muted);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.herb-report-rule-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.herb-report-rule {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--herb-report-border);
  border-radius: 999px;
  background-color: var(--herb-report-surface);
  font-size: 0.82rem;
}

.herb-report-rule-name {
  color: var(--herb-report-accent);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-decoration: none;
}

.herb-report-rule-name:hover {
  text-decoration: underline;
}

.herb-report-rule-count {
  color: var(--herb-report-muted);
  font-variant-numeric: tabular-nums;
}

.herb-report-file {
  margin-top: 2rem;
  border: 1px solid var(--herb-report-border);
  border-radius: 10px;
  background-color: var(--herb-report-surface);
  overflow: hidden;
}

.herb-report-file-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background-color: var(--herb-report-surface-raised);
  cursor: pointer;
}

.herb-report-file-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.herb-report-file-count {
  flex: none;
  color: var(--herb-report-muted);
  font-size: 0.8rem;
}

.herb-report-card {
  padding: 1rem;
  border-top: 1px solid var(--herb-report-border);
}

.herb-report-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.7rem;
}

.herb-report-dot {
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background-color: var(--herb-severity-hint, #8A929F);
}

.herb-report-dot-error {
  background-color: var(--herb-severity-error, #F14C4C);
}

.herb-report-dot-warning {
  background-color: var(--herb-severity-warning, #E5C07B);
}

.herb-report-dot-info {
  background-color: var(--herb-severity-info, #56B6C2);
}

.herb-report-dot-hint {
  background-color: var(--herb-severity-hint, #8A929F);
}

.herb-report-card-rule {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  font-weight: 600;
}

.herb-report-excerpt,
.herb-report-frame-excerpt,
.herb-report-fix-diff {
  overflow-x: auto;
  padding: 0.75rem;
  border: 1px solid var(--herb-report-border);
  border-radius: 8px;
  background-color: #101216;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.82rem;
  line-height: 1.55;
}

.herb-report-missing {
  margin: 0;
  color: var(--herb-report-muted);
}

.herb-report-chain {
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--herb-report-border);
  border-left: 3px solid var(--herb-report-accent);
  border-radius: 8px;
}

.herb-report-chain-verdict {
  margin: 0 0 0.75rem;
  color: var(--herb-report-muted);
  font-size: 0.85rem;
}

.herb-report-verdict-offending {
  color: var(--herb-severity-warning, #E5C07B);
  font-weight: 600;
}

.herb-report-verdict-total {
  color: inherit;
  font-weight: 600;
}

.herb-report-chain-unknown {
  margin: 1rem 0 0;
  color: var(--herb-report-muted);
  font-size: 0.85rem;
  font-style: italic;
}

.herb-report-chain-title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  margin: 0 0 0.6rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--herb-report-muted);
}

.herb-report-chain-order {
  font-weight: 400;
  letter-spacing: 0;
  opacity: 0.75;
}

.herb-report-frames {
  margin: 0;
  padding: 0 0 0 0.75rem;
  border-left: 2px solid var(--herb-report-border);
  list-style: none;
}

.herb-report-frame {
  position: relative;
}

.herb-report-frame::before {
  content: "";
  position: absolute;
  top: 0.62rem;
  left: -1.16rem;
  width: 0.5rem;
  height: 0.5rem;
  border: 2px solid var(--herb-report-border);
  border-radius: 50%;
  background: var(--herb-report-surface);
}

.herb-report-frame-offending::before {
  border-color: var(--herb-severity-warning, #E5C07B);
}

.herb-report-frame-terminal::before {
  border-color: var(--herb-severity-error, #E06C75);
  background: var(--herb-severity-error, #E06C75);
}

.herb-report-frame-body {
  margin: 0;
}

.herb-report-frame-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0;
  padding: 0.3rem 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.82rem;
  list-style: none;
  cursor: pointer;
}

.herb-report-frame-heading::-webkit-details-marker { display: none; }
.herb-report-frame-heading::marker { content: ""; }

.herb-report-frame-terminal > .herb-report-frame-heading {
  cursor: default;
}

.herb-report-frame-index {
  min-width: 1.4rem;
  color: var(--herb-report-muted);
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

.herb-report-frame-verb {
  color: var(--herb-report-muted);
}

.herb-report-frame-target {
  color: var(--herb-report-accent);
  font-family: inherit;
  overflow-wrap: anywhere;
}

.herb-report-frame-body[open] > .herb-report-frame-heading {
  color: inherit;
}

.herb-report-frame-body > .herb-report-frame-excerpt {
  margin-top: 0.25rem;
}

.herb-report-frame-open {
  margin: 0.3rem 0 0.6rem;
  font-size: 0.78rem;
}

.herb-report-frame-open a {
  color: var(--herb-report-accent);
}

.herb-report-breadcrumb {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.herb-report-tag {
  color: var(--herb-report-muted);
}

.herb-report-tag-offending {
  color: var(--herb-severity-warning, #E5C07B);
  font-weight: 600;
}

.herb-report-tag-separator {
  color: var(--herb-report-muted);
}

.herb-report-frame-marker {
  padding: 0.05rem 0.45rem;
  border: 1px solid var(--herb-severity-warning, #E5C07B);
  border-radius: 999px;
  color: var(--herb-severity-warning, #E5C07B);
  font-size: 0.72rem;
}

.herb-report-others {
  margin-top: 0.85rem;
}

.herb-report-others-summary {
  color: var(--herb-report-muted);
  font-size: 0.8rem;
  cursor: pointer;
}

.herb-report-other-list {
  margin: 0.4rem 0 0;
  padding: 0 0 0 1.1rem;
  list-style: none;
}

.herb-report-other {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.2rem 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
}

.herb-report-other-target {
  color: var(--herb-report-accent);
  overflow-wrap: anywhere;
}

.herb-report-other-offending .herb-report-other-target {
  color: var(--herb-severity-warning, #E5C07B);
}

.herb-report-other-repeat {
  color: var(--herb-report-muted);
}

.herb-report-chain-footer {
  margin: 0.75rem 0 0;
  color: var(--herb-report-muted);
  font-size: 0.8rem;
}

.herb-report-fix {
  margin-top: 1rem;
  border: 1px solid var(--herb-report-border);
  border-radius: 8px;
}

.herb-report-fix-summary {
  padding: 0.55rem 0.85rem;
  color: var(--herb-report-muted);
  font-size: 0.82rem;
  cursor: pointer;
}

.herb-report-flag {
  padding: 0 0.3rem;
  border-radius: 4px;
  background-color: var(--herb-inline-code-bg, rgba(160, 170, 190, 0.16));
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.herb-report-fix-diff {
  margin: 0 0.85rem 0.85rem;
}

@media (prefers-color-scheme: light) {
  .herb-report-page {
    background-color: #FFFFFF;
    color: #24292F;
  }

  .herb-report-root {
    --herb-report-surface: #F6F8FA;
    --herb-report-surface-raised: #EDF1F5;
    --herb-report-border: #D7DDE4;
    --herb-report-muted: #5B6672;
    --herb-report-accent: #0969DA;

    --herb-rule: #D7DDE4;
    --herb-rule-label: #5B6672;
    --herb-rule-label-bg: #FFFFFF;
    --herb-tooltip-bg: #FFFFFF;
    --herb-inline-code-bg: rgba(27, 31, 36, 0.08);
    --herb-line-number: #8C959F;
    --herb-line-number-focus: #0969DA;
    --herb-file-header: #0969DA;
    --herb-severity-error: #CF222E;
    --herb-severity-warning: #9A6700;
    --herb-severity-info: #0969DA;
    --herb-severity-hint: #5B6672;
    --herb-marker-error-bg: rgba(207, 34, 46, 0.12);
    --herb-marker-warning-bg: rgba(154, 103, 0, 0.12);
    --herb-marker-info-bg: rgba(9, 105, 218, 0.12);
    --herb-marker-hint-bg: rgba(91, 102, 114, 0.12);
    --herb-diff-added-number: #1A7F37;
  }

  .herb-report-excerpt,
  .herb-report-frame-excerpt,
  .herb-report-fix-diff {
    background-color: #FFFFFF;
  }
}
`

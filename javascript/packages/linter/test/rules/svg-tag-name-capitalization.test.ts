import { describe, test } from "vitest"
import { SVGTagNameCapitalizationRule } from "../../src/rules/svg-tag-name-capitalization.js"
import { createLinterTest } from "../helpers/linter-test-helper.js"

const { expectNoOffenses, expectError, assertOffenses } = createLinterTest(SVGTagNameCapitalizationRule)

describe("svg-tag-name-capitalization", () => {
  test("passes for correctly cased SVG elements", () => {
    expectNoOffenses(`
      <svg>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1" />
        </linearGradient>
        <radialGradient id="grad2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:rgb(255,255,255);stop-opacity:0" />
          <stop offset="100%" style="stop-color:rgb(0,0,255);stop-opacity:1" />
        </radialGradient>
        <clipPath id="myClip">
          <rect x="0" y="0" width="100" height="100" />
        </clipPath>
        <foreignObject x="20" y="20" width="160" height="160">
          <div>HTML content</div>
        </foreignObject>
        <text>
          <textPath href="#path">Text along a path</textPath>
        </text>
      </svg>
    `)
  })

  test("passes for SVG filter elements with correct camelCase", () => {
    expectNoOffenses(`
      <svg>
        <filter id="blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" />
          <feBlend mode="multiply" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>
    `)
  })

  test("fails for incorrectly cased SVG elements", () => {
    expectError('Opening SVG tag name `LINEARGRADIENT` should use proper capitalization. Use `linearGradient` instead.')
    expectError('Closing SVG tag name `LINEARGRADIENT` should use proper capitalization. Use `linearGradient` instead.')
    expectError('Opening SVG tag name `lineargradient` should use proper capitalization. Use `linearGradient` instead.')
    expectError('Closing SVG tag name `lineargradient` should use proper capitalization. Use `linearGradient` instead.')
    expectError('Opening SVG tag name `CLIPPATH` should use proper capitalization. Use `clipPath` instead.')
    expectError('Closing SVG tag name `CLIPPATH` should use proper capitalization. Use `clipPath` instead.')

    assertOffenses(`
      <svg>
        <LINEARGRADIENT id="grad1">
          <stop offset="0%" />
        </LINEARGRADIENT>
        <lineargradient id="grad2">
          <stop offset="100%" />
        </lineargradient>
        <CLIPPATH id="clip">
          <rect x="0" y="0" width="100" height="100" />
        </CLIPPATH>
      </svg>
    `)
  })

  test("passes for animateMotion and animateTransform", () => {
    expectNoOffenses(`
      <svg>
        <animateMotion dur="10s" repeatCount="indefinite">
          <mpath href="#path1" />
        </animateMotion>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 60 70"
          to="360 60 70"
          dur="10s"
          repeatCount="indefinite" />
      </svg>
    `)
  })

  test("ignores non-SVG elements", () => {
    expectNoOffenses(`
      <div>
        <LINEARGRADIENT id="grad1">
          <stop offset="0%" />
        </LINEARGRADIENT>
        <clipPath id="clip">
          <rect x="0" y="0" width="100" height="100" />
        </clipPath>
      </div>
    `)
  })

  test("only checks elements within SVG context", () => {
    expectError('Opening SVG tag name `LINEARGRADIENT` should use proper capitalization. Use `linearGradient` instead.')
    expectError('Closing SVG tag name `LINEARGRADIENT` should use proper capitalization. Use `linearGradient` instead.')

    assertOffenses(`
      <div>
        <P>Outside SVG</P>
        <svg>
          <linearGradient>Valid SVG</linearGradient>
          <LINEARGRADIENT>Invalid SVG</LINEARGRADIENT>
        </svg>
        <P>Outside SVG again</P>
      </div>
    `)
  })
})

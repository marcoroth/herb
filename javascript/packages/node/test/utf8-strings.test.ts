import { describe, test, expect, beforeAll } from "vitest"
import { Herb } from "../src/index.js"

describe("UTF-8 string handling", () => {
  beforeAll(async () => {
    await Herb.load()
  })

  describe("parse preserves multi-byte UTF-8 in text content", () => {
    test("2-byte characters (Latin Extended)", () => {
      const result = Herb.parse('<p>Café résumé naïve</p>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("2-byte characters (special symbols)", () => {
      const result = Herb.parse('<p>ç àöü ± Ç ≠ ¿ ´</p>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("3-byte characters (em dash, en dash)", () => {
      const result = Herb.parse('<p>Em dash — en dash –</p>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("3-byte characters (Cyrillic)", () => {
      const result = Herb.parse('<p>Тест Привет Мир</p>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("3-byte characters (CJK)", () => {
      const result = Herb.parse('<p>日本語 中文 한국어</p>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("4-byte characters (emoji)", () => {
      const result = Herb.parse('<p>🚀 🍰 ✨ 💎 🎉</p>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("mixed multi-byte characters", () => {
      const result = Herb.parse('<p>Café 🍰 — Тест</p>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })
  })

  describe("parse preserves UTF-8 in attribute values", () => {
    test("emoji in attribute value", () => {
      const result = Herb.parse('<div title="🚀"></div>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("Cyrillic in attribute value", () => {
      const result = Herb.parse('<div title="Тест"></div>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })
  })

  describe("extractHTML preserves UTF-8", () => {
    test("preserves multi-byte characters", () => {
      expect(Herb.extractHTML('<p>Café — 🚀 Тест</p>')).toMatchSnapshot()
    })

    test("preserves UTF-8 in attributes", () => {
      expect(Herb.extractHTML('<div title="Тест">🚀</div>')).toMatchSnapshot()
    })
  })

  describe("extractRuby preserves UTF-8", () => {
    test("preserves multi-byte characters", () => {
      expect(Herb.extractRuby('<%= "Café 🚀" %>')).toMatchSnapshot()
    })
  })

  describe("handles edge cases", () => {
    test("incomplete comment has empty token value not null", () => {
      const result = Herb.parse('<!--')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("incomplete comment preserves content", () => {
      const result = Herb.parse('<!-- content ')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })

    test("non-breaking space is preserved", () => {
      const result = Herb.parse('<p>before\u00A0after</p>')
      expect(result.value.inspect().trim()).toMatchSnapshot()
    })
  })
})

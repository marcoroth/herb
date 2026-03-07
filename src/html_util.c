#include "include/html_util.h"
#include "include/util/hb_allocator.h"
#include "include/util/hb_buffer.h"
#include "include/util/hb_string.h"

#include <ctype.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

// https://developer.mozilla.org/en-US/docs/Glossary/Void_element
static hb_string_T void_tags[] = HB_STRING_LIST(
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
);

// https://html.spec.whatwg.org/multipage/syntax.html#optional-tags
static hb_string_T optional_end_tags[] = HB_STRING_LIST(
  "li",
  "dt",
  "dd",
  "p",
  "rt",
  "rp",
  "optgroup",
  "option",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "colgroup"
);

static hb_string_T p_closers[] = HB_STRING_LIST(
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "div",
  "dl",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "main",
  "menu",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul"
);

static hb_string_T p_parent_closers[] = HB_STRING_LIST(
  "article",
  "aside",
  "blockquote",
  "body",
  "details",
  "div",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "header",
  "main",
  "nav",
  "section",
  "td",
  "th",
  "li",
  "dd",
  "template"
);

bool is_void_element(hb_string_T tag_name) {
  if (hb_string_is_empty(tag_name)) { return false; }

  for (size_t i = 0; i < sizeof(void_tags) / sizeof(void_tags[0]); i++) {
    if (hb_string_equals_case_insensitive(tag_name, void_tags[i])) { return true; }
  }

  return false;
}

bool has_optional_end_tag(hb_string_T tag_name) {
  if (hb_string_is_empty(tag_name)) { return false; }

  for (size_t i = 0; i < sizeof(optional_end_tags) / sizeof(optional_end_tags[0]); i++) {
    if (hb_string_equals_case_insensitive(tag_name, optional_end_tags[i])) { return true; }
  }

  return false;
}

static bool tag_in_list(hb_string_T tag_name, hb_string_T* list, size_t count) {
  for (size_t i = 0; i < count; i++) {
    if (hb_string_equals_case_insensitive(tag_name, list[i])) { return true; }
  }

  return false;
}

bool should_implicitly_close(hb_string_T open_tag_name, hb_string_T next_tag_name) {
  if (hb_string_is_empty(open_tag_name)) { return false; }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("li"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("li"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("dt"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("dt"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("dd"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("dd"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("dd"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("dt"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("p"))) {
    return tag_in_list(next_tag_name, p_closers, sizeof(p_closers) / sizeof(p_closers[0]));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("rt"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("rt"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("rp"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("rp"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("rp"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("rt"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("optgroup"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("optgroup"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("option"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("option"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("optgroup"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("thead"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("tbody"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("tfoot"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("tbody"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("tbody"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("tfoot"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("tr"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("tr"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("td"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("td"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("th"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("th"))) {
    return hb_string_equals_case_insensitive(next_tag_name, hb_string("th"))
        || hb_string_equals_case_insensitive(next_tag_name, hb_string("td"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("colgroup"))) {
    return !hb_string_equals_case_insensitive(next_tag_name, hb_string("col"));
  }

  return false;
}

bool parent_closes_element(hb_string_T open_tag_name, hb_string_T parent_close_tag_name) {
  if (hb_string_is_empty(open_tag_name)) { return false; }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("li"))) {
    return hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("ul"))
        || hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("ol"))
        || hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("menu"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("dt"))
      || hb_string_equals_case_insensitive(open_tag_name, hb_string("dd"))) {
    return hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("dl"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("p"))) {
    return tag_in_list(parent_close_tag_name, p_parent_closers, sizeof(p_parent_closers) / sizeof(p_parent_closers[0]));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("rt"))
      || hb_string_equals_case_insensitive(open_tag_name, hb_string("rp"))) {
    return hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("ruby"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("optgroup"))
      || hb_string_equals_case_insensitive(open_tag_name, hb_string("option"))) {
    return hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("select"))
        || hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("datalist"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("thead"))
      || hb_string_equals_case_insensitive(open_tag_name, hb_string("tbody"))
      || hb_string_equals_case_insensitive(open_tag_name, hb_string("tfoot"))) {
    return hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("table"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("tr"))) {
    return hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("thead"))
        || hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("tbody"))
        || hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("tfoot"))
        || hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("table"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("td"))
      || hb_string_equals_case_insensitive(open_tag_name, hb_string("th"))) {
    return hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("tr"));
  }

  if (hb_string_equals_case_insensitive(open_tag_name, hb_string("colgroup"))) {
    return hb_string_equals_case_insensitive(parent_close_tag_name, hb_string("table"));
  }

  return false;
}

/**
 * @brief Creates a closing HTML tag string like "</tag_name>"
 *
 * @param tag_name The name of the HTML tag to be enclosed in a closing tag
 * @return A newly allocated string containing the closing tag, or NULL if memory allocation fails
 * @note The caller is responsible for freeing the returned string
 *
 * Example:
 * @code
 * hb_string_T tag = html_closing_tag_string(hb_string("div"));
 *
 * printf("%.*s\n", tag.length, tag.data); // Prints: </div>
 * free(tag.data);
 * @endcode
 */
hb_string_T html_closing_tag_string(hb_string_T tag_name, struct hb_allocator* allocator) {
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, tag_name.length + 3, allocator);

  hb_buffer_append_char(&buffer, '<');
  hb_buffer_append_char(&buffer, '/');
  hb_buffer_append_string(&buffer, tag_name);
  hb_buffer_append_char(&buffer, '>');

  return hb_string(buffer.value);
}

/**
 * @brief Creates a self-closing HTML tag string like "<tag_name />"
 *
 * @param tag_name The name of the HTML tag to be enclosed in a self-closing tag
 * @return A newly allocated string containing the self-closing tag, or NULL if memory allocation fails
 * @note The caller is responsible for freeing the returned string
 *
 * Example:
 * @code
 * hb_string_T tag = html_self_closing_tag_string(hb_string("br"));
 * printf("%.*s\n", tag.length, tag.data); // Prints: <br />
 * free(tag);
 * @endcode
 */
hb_string_T html_self_closing_tag_string(hb_string_T tag_name, struct hb_allocator* allocator) {
  hb_buffer_T buffer;
  hb_buffer_init(&buffer, tag_name.length + 4, allocator);

  hb_buffer_append_char(&buffer, '<');
  hb_buffer_append_string(&buffer, tag_name);
  hb_buffer_append_char(&buffer, ' ');
  hb_buffer_append_char(&buffer, '/');
  hb_buffer_append_char(&buffer, '>');

  return hb_string(buffer.value);
}

#ifndef HERB_NUNJUCKS_KEYWORDS_H
#define HERB_NUNJUCKS_KEYWORDS_H

#include "../lib/hb_allocator.h"
#include "../lib/hb_string.h"

hb_string_T nunjucks_normalize_statement(hb_string_T content, hb_allocator_T* allocator);
hb_string_T nunjucks_normalize_statement_fixed_width(hb_string_T content, hb_allocator_T* allocator);
hb_string_T nunjucks_statement_keyword(hb_string_T content);

#endif

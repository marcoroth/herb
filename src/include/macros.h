#ifndef HERB_MACROS_H
#define HERB_MACROS_H

#ifndef HERB_EXPORTED_FUNCTION
#  ifdef HERB_EXPORT_SYMBOLS
#    define HERB_EXPORTED_FUNCTION __attribute__((__visibility__("default"))) extern
#  else
#    define HERB_EXPORTED_FUNCTION
#  endif
#endif

#define MAX(a, b) ((a) > (b) ? (a) : (b))

#define MIN(a, b) ((a) < (b) ? (a) : (b))

#define KB(kb) (1024 * (kb))

#define MB(mb) (1024 * KB(mb))

#define unlikely(x) __builtin_expect(!!(x), 0)

#endif

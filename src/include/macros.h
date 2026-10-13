#ifndef HERB_MACROS_H
#define HERB_MACROS_H

#ifndef HERB_EXPORTED_FUNCTION
#  if defined(HERB_EXPORT_SYMBOLS) && defined(_MSC_VER)
#    define HERB_EXPORTED_FUNCTION __declspec(dllexport) extern
#  elif defined(HERB_EXPORT_SYMBOLS)
#    define HERB_EXPORTED_FUNCTION __attribute__((__visibility__("default"))) extern
#  else
#    define HERB_EXPORTED_FUNCTION
#  endif
#endif

#define MAX(a, b) ((a) > (b) ? (a) : (b))

#define MIN(a, b) ((a) < (b) ? (a) : (b))

#define KB(kb) (1024 * (kb))

#define MB(mb) (1024 * KB(mb))

#ifdef _MSC_VER
#  define unlikely(x) (x)
#else
#  define unlikely(x) __builtin_expect(!!(x), 0)
#endif

#endif

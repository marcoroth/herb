#!/usr/bin/env bash
# Builds build/libherb_ffi.<ext>, one shared library with libherb, Prism and the FFI serializer.
#
# We rebuild from scratch every time. `rake templates` can change struct layouts in the
# headers, and mixing old and new object files would give a broken library.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f ffi/serialize.c ]]; then
  echo "ffi/serialize.c is missing, run 'bundle exec rake templates' first" >&2
  exit 1
fi

ext=$(ruby -e 'puts RbConfig::CONFIG["host_os"] =~ /darwin/ ? "dylib" : "so"')
obj=build/ffi_obj
rm -rf "$obj"
mkdir -p "$obj"

# Same flags as ext/herb/extconf.rb. HERB_EXPORT_SYMBOLS keeps the exported herb_* functions
# visible despite -fvisibility=hidden.
cflags=(-O2 -fPIC -std=gnu99 -fvisibility=hidden -DHERB_EXPORT_SYMBOLS
  -DHERB_EXCLUDE_PRETTYPRINT -DPRISM_EXCLUDE_PRETTYPRINT -DPRISM_EXCLUDE_JSON -DPRISM_EXCLUDE_PACK
  -Isrc/include -Ivendor/prism/include)

objects=()
while IFS= read -r source; do
  object="$obj/$(echo "$source" | tr / _).o"
  ${CC:-cc} -c "${cflags[@]}" "$source" -o "$object"
  objects+=("$object")
done < <(find src vendor/prism/src ffi -name '*.c' ! -path src/main.c)

${CC:-cc} -shared "${objects[@]}" -o "build/libherb_ffi.$ext"
echo "build/libherb_ffi.$ext"

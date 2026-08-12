#include "../include/diff/herb_hash.h"

herb_hash_T herb_hash_byte(herb_hash_T hash, const uint8_t byte) {
  hash ^= (herb_hash_T) byte;
  hash *= HERB_HASH_FNV_PRIME;

  return hash;
}

herb_hash_T herb_hash_bytes(herb_hash_T hash, const void* data, const size_t length) {
  const uint8_t* bytes = (const uint8_t*) data;

  for (size_t index = 0; index < length; index++) {
    hash = herb_hash_byte(hash, bytes[index]);
  }

  return hash;
}

herb_hash_T herb_hash_uint32(herb_hash_T hash, const uint32_t value) {
  return herb_hash_bytes(hash, &value, sizeof(value));
}

herb_hash_T herb_hash_uint64(herb_hash_T hash, const uint64_t value) {
  return herb_hash_bytes(hash, &value, sizeof(value));
}

herb_hash_T herb_hash_bool(herb_hash_T hash, const bool value) {
  const uint8_t byte = value ? 1 : 0;

  return herb_hash_byte(hash, byte);
}

herb_hash_T herb_hash_string(herb_hash_T hash, const hb_string_T string) {
  hash = herb_hash_uint64(hash, (uint64_t) string.length);

  return herb_hash_bytes(hash, string.data, string.length);
}

herb_hash_T herb_hash_combine(herb_hash_T hash, const herb_hash_T other) {
  return herb_hash_uint64(hash, other);
}

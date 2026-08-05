# Herb Java/JNI Bindings

Java bindings for the Herb HTML+ERB parser using JNI (Java Native Interface).

## Quick Start

### Prerequisites

```bash
java -version
```

### Build

```bash
cd java

make templates
make jni
make java
```

This creates `../build/libherb_jni.dylib` (or `.so` on Linux).

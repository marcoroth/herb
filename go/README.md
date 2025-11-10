# Herb Go Bindings

Go bindings for Herb - Powerful and seamless HTML-aware ERB parsing and tooling.

## Building

### Prerequisites

- Go 1.20 or later
- C compiler (gcc/clang)
- Herb C library built from parent directory
- [c-for-go](https://github.com/xlab/c-for-go) go-lang bindings generator

### Build

```bash
# Build herb C library from project root
cd ..
make build/libherb.a
make prism

# Generate bindings
cd go
make build
```

## Usage

### As a Library

```go
package main

import (
    "fmt"
    "github.com/marcoroth/herb"
)

func main() {
    template := "<h1><%= title %></h1>"

    // Lex ERB template
    tokens := herb.Lex(template)
    if tokens != nil {
        fmt.Println("Lexing successful")
    }

    // Parse ERB template
    ast := herb.Parse(template, nil)
    if ast != nil {
        fmt.Println("Parsing successful")
    }

    // Extract Ruby code
    ruby := herb.Extract(template, 0)
    if ruby != nil {
        fmt.Printf("Ruby: %s\n", string(*ruby))
    }
}
```

## Testing

```bash
cd herb
go test -v
```

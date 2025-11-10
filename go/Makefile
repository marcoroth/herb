# generates go bindings
build:
	c-for-go herb.yml

# cleanup generated files
clean:
	rm -f herb/cgo_helpers.go herb/cgo_helpers.h herb/cgo_helpers.c
	rm -f herb/const.go herb/doc.go herb/types.go
	rm -f herb/herb.go
	rm -rf bin/

# test build and run tests
test:
	cd herb && go build && go test

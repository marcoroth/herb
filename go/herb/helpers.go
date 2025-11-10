package herb

/*
#include "herb_go.h"
#include <stdlib.h>
*/
import "C"

// HerbVersion returns the herb library version as a string
func HerbVersion() string {
	return C.GoString(C.herb_version())
}

// PrismVersion returns the prism library version as a string
func PrismVersion() string {
	return C.GoString(C.herb_prism_version())
}

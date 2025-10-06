/*
* Math interface, currently based on https://mathjs.org
*
* Offers a palette of functions. The custom interface is necessary
* if I later want to write a custom linear algebra library.
*/

// Returns an identity matrix of given size
export function identity(size) {
  return math.identity(size); // mathjs identity function
}
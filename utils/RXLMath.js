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

/**
 * Returns a 4x4 world transformation matrix.
 * @param {number[]} position - [x, y, z]
 * @param {number[]} rotation - [rx, ry, rz] in radians
 * @returns {math.Matrix} 4x4 transformation matrix
 */
export function toWorldTransform(position, rotation) {
    const [x, y, z] = position;
    const [rx, ry, rz] = rotation;

    // Rotation matrices around X, Y, Z
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const cosZ = Math.cos(rz), sinZ = Math.sin(rz);

    const rotX = math.matrix([
        [1, 0,    0,   0],
        [0, cosX, -sinX, 0],
        [0, sinX, cosX,  0],
        [0, 0,    0,    1]
    ]);

    const rotY = math.matrix([
        [cosY,  0, sinY, 0],
        [0,     1, 0,    0],
        [-sinY, 0, cosY, 0],
        [0,     0, 0,    1]
    ]);

    const rotZ = math.matrix([
        [cosZ, -sinZ, 0, 0],
        [sinZ, cosZ,  0, 0],
        [0,    0,     1, 0],
        [0,    0,     0, 1]
    ]);

    // Combined rotation: R = Rz * Ry * Rx
    const rotationMatrix = math.multiply(rotZ, rotY, rotX);

    // Translation matrix
    const translationMatrix = math.matrix([
        [1, 0, 0, x],
        [0, 1, 0, y],
        [0, 0, 1, z],
        [0, 0, 0, 1]
    ]);

    // World transform: T * R
    const worldMatrix = math.multiply(translationMatrix, rotationMatrix);

    return worldMatrix;
}

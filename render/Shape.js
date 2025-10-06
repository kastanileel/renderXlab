import { RenderObject } from "./RenderObject.js";

export class Shape extends RenderObject{
    constructor(){
        super();
        console.log("constructing shape");
    }
}

export class Mesh extends Shape{

    #vertices;
    #indices;
    #uvCoordinates;
    #normals;

    constructor(filePath) {
        super();

        this.#vertices = [
            [0.5, 1.0, 0.0],
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0]
        ];

        this.#indices = [
            [0, 1, 2]
        ];

        this.#normals = [
            [0, 0, 1.0],
            [0, 0, 1.0],
            [0, 0, 1.0]
        ];

        this.#uvCoordinates =[
            [0.5, 1.0],
            [0.0, 0.0],
            [1.0, 0.0]
        ];
    }
}
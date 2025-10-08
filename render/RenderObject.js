import { identity } from "../utils/RXLMath.js";
import { RXLContext } from "../core/rXlContext.js";

export class RenderObject{

    #transformationMatrix; 
    constructor(){
        console.log("Render object!");

        this.#transformationMatrix = identity(4);
    }

    setPosition(positon) {
      
    }

    setTransformation(matrix){
        this.#transformationMatrix = matrix;
    }

    getTransformation(){
        return this.#transformationMatrix;
    }

    // "virtual" function, all render objects should allocate their buffers here
    build(context) {
        throw new Error("RenderObject.build() is a virtual function please override it!");
    }
}
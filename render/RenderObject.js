import { identity } from "../utils/RXLMath.js";

export class RenderObject{

    #transformationMatrix; 
    constructor(){
        console.log("Render object!");

        this.#transformationMatrix = identity(4);
    }

    setPosition(positon) {
      
    }

    getTransformation(){
        return this.#transformationMatrix;
    }
}
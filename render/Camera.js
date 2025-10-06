import { RenderObject } from "./RenderObject.js";

export class Camera extends RenderObject{
    constructor() {
        super();
        console.log("Camera!");
    }
}

export class PinholeCamera extends Camera{

    #fov;

    constructor(){
        super();

        // currently in degrees
        this.#fov = 60;
    }
}
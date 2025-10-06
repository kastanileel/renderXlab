import { RenderObject } from "./RenderObject";

export class Camera extends RenderObject{
    constructor() {
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
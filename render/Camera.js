import { RenderObject } from "./RenderObject.js";

export class Camera extends RenderObject{
   
    constructor() {
        super();
        console.log("Camera!");
    }

     // "virtual" function
    build(context) {
        throw new Error("Camera.build() is a virtual function please override it!");
    }
}

export class PinholeCamera extends Camera{

    #fov;
    #cameraDataBuffer;

    constructor(){
        super();

        // currently in degrees
        this.#fov = 60;
    }

    build(context) {

        // num of f32 variables * 4 byte
        const cameraDataSize = 3*4;
    
        this.#cameraDataBuffer = context.getDevice().createBuffer({
            size: cameraDataSize,
            usage: GPUBuffer.STORAGE | GPUBuffer.COPY_DST,
        });

        const cameraData = new Float32Array([
             // Front face (z = 0.5)
            -0.5, -0.5,  0.5,
            0.5, -0.5,  0.5,
            0.5,  0.5,  0.5,
            -0.5,  0.5,  0.5,

            // Back face (z = -0.5)
            -0.5, -0.5, -0.5,
            0.5, -0.5, -0.5,
            0.5,  0.5, -0.5,
            -0.5,  0.5, -0.5,
        ]);
        this.context.device.queue.writeBuffer(this.vertexBuffer, 0, cube);
    }
}
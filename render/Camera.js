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

    getBindGroup(context, layout){
        throw new Error("Camera.getBindGroup() is a virtual function please override it");
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

    async build(context) {

        console.log("building camera buffer");
        // num of f32 variables * 4 byte
        const cameraDataSize = 3*4;
    
        this.#cameraDataBuffer = context.getDevice().createBuffer({
            size: cameraDataSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // position, will be extended
        const cameraData = new Float32Array([
           0, 0, -8 
        ]);

        await context.getDevice().queue.writeBuffer(this.#cameraDataBuffer, 0, cameraData);
    }

    getBindGroup(context, layout){

        const bindGroupCamera = context.getDevice().createBindGroup({
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.#cameraDataBuffer
                    }
                }
            ]
        });

        return bindGroupCamera;
    }

}
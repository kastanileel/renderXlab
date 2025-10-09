import { RenderObject } from "./RenderObject.js";

export class Camera extends RenderObject{
  
    static _constructed = false;
    constructor() {
        if(!Camera._constructed){
            throw new Error("Camera");
        }
        super();
        console.log("Camera!");

        Camera._constructed = false;
    }

    // "virtual" function
    async build(context) {
        throw new Error("Camera.build() is a virtual function please override it!");
    }

    async getBindGroupLayout(context){
        throw new Error("Camera.getBindGroupLayout() is a virtual function please override it!");
    }

    getBindGroup(context, layout){
        throw new Error("Camera.getBindGroup() is a virtual function please override it");
    }
}

export class PinholeCamera extends Camera{

    #fov;
    #cameraDataBuffer;

    static async create(){
        Camera._constructed = true;
        return new PinholeCamera();
    }

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
            size: (cameraDataSize+15)&~15,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        // position, will be extended
        const cameraData = new Float32Array([
           0.0, 0.0, 5.0
        ]);

        await context.getDevice().queue.writeBuffer(this.#cameraDataBuffer, 0, cameraData);
    }

    async getBindGroupLayout(context){
        const bindGroupLayoutCamera = await context.getDevice().createBindGroupLayout({ 
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                }
            ]
        });

        return bindGroupLayoutCamera;
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
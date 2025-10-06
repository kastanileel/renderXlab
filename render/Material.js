import { RenderObject } from "./RenderObject.js";

export class Material extends RenderObject{

    constructor() {
        super();
        console.log("Material!");
    }

     // "virtual" function
    build(context) {
        throw new Error("Material.build() is a virtual function please override it!");
    }
     
    getBindGroup(context, layout){
        throw new Error("Material.getBindGroup() is a virtual function please override it");
    }
}

export class LambertianDiffuse extends Material{

    #albedo;
    #materialBuffer;

    constructor(){
        super();

        this.#albedo = [1.0, 0.0, 0.0];
    }

    build(context) {

        // num of f32 variables * 4 byte
        const materialDataSize = 3*4;
    
        this.#materialBuffer = context.getDevice().createBuffer({
            size: materialDataSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 
        });

        const materialData = new Float32Array([
            this.#albedo[0], this.#albedo[1], this.#albedo[2]
        ]);

        context.getDevice().queue.writeBuffer(this.#materialBuffer, 0, materialData);
    }

    getBindGroup(context, layout){

        const bindGroupMaterial = context.getDevice().createBindGroup({
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.#materialBuffer
                    }
                }
            ]
        });

        return bindGroupMaterial;
    }
}
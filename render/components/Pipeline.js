import { RXLContext } from "../../core/rXlContext.js";
import { ShaderModule } from "./ShaderModule.js";

export class Pipeline{

    #pipeline;

   // same creation logic like in RXLContext.js
    static #constructed = false;
    static async create(context, shaderModule, scene, ui){
      
        // bind group 0 should contain fixed stuff like the accumulation image
        // and the uniform buffer
        const bindGroupLayout = await context.getDevice().createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE, 
                    storageTexture: { 
                        access: "write-only",
                        format: "rgba8unorm",
                        viewDimension: "2d",
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                        minBindingSize: 24, // match your uniform struct size
                    },
                },
            ],
        });

        // Todo: bindgroup 1: containing camera specific info
        // Todo: bindgroup 2: containing shape specific info
        // Todo: bindgroup 3: containing material specific info
        // => mapping from shapeid->materialid is might be done via a lut found in bingroup 0

        const pipelineLayout = await context.getDevice().createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        }); 

        const pipeline = await context.getDevice().createComputePipeline({
            label: 'pipeline0',
            layout: pipelineLayout,
            compute: shaderModule.getModule(), 
        });

        Pipeline.#constructed = true;
        
        return new Pipeline(pipeline);
    }    

    constructor(pipeline){
        if(!Pipeline.#constructed){
            throw new Error("Use Pipeline.create() for creating a new pipeline!");
        }
            
        this.#pipeline = pipeline;

        Pipeline.#constructed = false;
    }

    getPipeline(){
    return this.#pipeline;
    }
}
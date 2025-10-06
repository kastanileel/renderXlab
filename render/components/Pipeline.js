import { RXLContext } from "../../core/rXlContext.js";
import { ShaderModule } from "./ShaderModule.js";
import {Scene} from "../Scene.js"
import { UIManager } from "./UIManager.js";

export class Pipeline{

    #pipeline;

    #uniformBuffer;
    #texture;
    #context;
    #uiManager;

    #otherBindGroups;
   // same creation logic like in RXLContext.js
    static #constructed = false;
    static async create(context, shaderModule, scene, uiManager){

        // create buffers

        // accumulation image
        const texture = context.getDevice().createTexture({
            size: [context.getCanvas().width, context.getCanvas().height, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // uniform buffer
        var uniformBufferSize = 4 + uiManager.getTotalSizeInBytes();
        
        // minimum binding size 
        if(uniformBufferSize < 24) {
            uniformBufferSize = 24;
        }

        const uniformBuffer = context.getDevice().createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        }); 

        const uniformData = new Float32Array([
            0.0,
        ]);
        context.getDevice().queue.writeBuffer(uniformBuffer, 0, uniformData);

        // all render object allocate their buffers 
        await scene.build(context);
     
        // bind group 0 should contain fixed stuff like the accumulation image
        // and the uniform buffer
        const bindGroupLayout0 = await context.getDevice().createBindGroupLayout({
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

        const otherBindGroupLayouts = await scene.getBindGroupLayouts(context);
        // Todo: bindgroup 1: containing camera specific info
        // Todo: bindgroup 2: containing shape specific info
        // Todo: bindgroup 3: containing material specific info
        // => mapping from shapeid->materialid is might be done via a lut found in bingroup 0
        
        const pipelineLayout = await context.getDevice().createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout0, ...otherBindGroupLayouts],
        }); 

        const pipeline = await context.getDevice().createComputePipeline({
            label: 'pipeline0',
            layout: pipelineLayout,
            compute: shaderModule.getModule(), 
        });

        const otherBindGroups = scene.getBindGroups(context, pipeline);

        Pipeline.#constructed = true;
        return new Pipeline(pipeline, context, uniformBuffer, texture, uiManager, otherBindGroups);
    }    

    constructor(pipeline, context, uniformBuffer, texture, uiManager, otherBindGroups){
        if(!Pipeline.#constructed){
            throw new Error("Use Pipeline.create() for creating a new pipeline!");
        }
            
        this.#pipeline = pipeline;
        this.#context = context;
        this.#uniformBuffer = uniformBuffer;
        this.#texture = texture;
        this.#uiManager = uiManager;

        this.#otherBindGroups = otherBindGroups;

        Pipeline.#constructed = false;
    }

    getPipeline(){
    return this.#pipeline;
    }

    async update(currentTime, deltaTime){
       const [state, size] = this.#uiManager.getState();

        var uniformSize = 1;
        // Iterate through the size Map
        for (const [key, value] of size) {
            uniformSize += value;
        }

        console.log(uniformSize);
        const uniformData = new Float32Array(uniformSize);
        uniformData[0] = currentTime/1000.0;

        // currently assume each element has size 1
        let counter = 1;
        for (const [key, value] of state){
            uniformData[counter] = value;
            counter += 1;
        }

        this.#context.getDevice().queue.writeBuffer(this.#uniformBuffer, 0, uniformData); 

        const uniformDataa = new Float32Array([
            currentTime/1000.0,           
        ]);

        this.#context.getDevice().queue.writeBuffer(this.#uniformBuffer, 0, uniformDataa); 


        // Todo:
        // this.#scene.update();
    }

    async dispatch(){
        const textureView = this.#texture.createView();
        // bind buffer to bind group 0
        const bindGroup = this.#context.getDevice().createBindGroup({
            layout: this.#pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: textureView,
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.#uniformBuffer,
                    },
                },
            ],
        });

        const commandEncoder = this.#context.getDevice().createCommandEncoder();
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(this.#pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setBindGroup(1, this.#otherBindGroups[0]);
        pass.setBindGroup(2, this.#otherBindGroups[1]);
        pass.setBindGroup(3, this.#otherBindGroups[2]);

        // Dispatch workgroups to cover the entire texture
        const workgroupSize = 8;
        pass.dispatchWorkgroups(
            Math.ceil(this.#context.getCanvas().width / workgroupSize),
            Math.ceil(this.#context.getCanvas().height / workgroupSize)
        );

        pass.end();


        // The size of one pixel in bytes (RGBA8 = 4 bytes)
        const bytesPerPixel = 4;
        const bytesPerRow = Math.ceil(this.#context.getCanvas().width * bytesPerPixel / 256) * 256;
        const bufferSize = bytesPerRow * this.#context.getCanvas().height;

        const gpuBuffer = this.#context.getDevice().createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

         // Copy the texture data to the buffer
        commandEncoder.copyTextureToBuffer(
            { texture: this.#texture },
            { buffer: gpuBuffer, bytesPerRow: bytesPerRow, rowsPerImage: this.#context.getCanvas().height },
            [ this.#context.getCanvas().width,  this.#context.getCanvas().height]
        );

        this.#context.getDevice().queue.submit([commandEncoder.finish()]);

        // Map buffer to CPU
        await gpuBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = gpuBuffer.getMappedRange();

        // Create a new Uint8ClampedArray and copy the data to handle potential padding
        const data = new Uint8ClampedArray( this.#context.getCanvas().width *  this.#context.getCanvas().height * bytesPerPixel);
        let srcOffset = 0;
        let dstOffset = 0;
        for (let i = 0; i <  this.#context.getCanvas().height; i++) {
            data.set(new Uint8ClampedArray(arrayBuffer, srcOffset, this.#context.getCanvas().width * bytesPerPixel), dstOffset);
            srcOffset += bytesPerRow;
            dstOffset +=  this.#context.getCanvas().width * bytesPerPixel;
        }

        // Put data into ImageData and draw on canvas
        const imageData = new ImageData(data,  this.#context.getCanvas().width,  this.#context.getCanvas().height);
        this.#context.getCanvas().getContext("2d").putImageData(imageData, 0, 0);

        gpuBuffer.unmap();
    }
}
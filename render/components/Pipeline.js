import { RXLContext } from "../../core/rXlContext.js";
import { ShaderModule } from "./ShaderModule.js";
import {Scene} from "../Scene.js"
import { UIManager } from "./UIManager.js";

export class Pipeline{

    #pipeline;

    #uniformBuffer;
    #accumulationTexture;
    #previousAccumTexture;
    #context;
    #uiManager;

    #otherBindGroups;

    #cubemapTexture;
    #cubemapSampler;

    #spp;
   // same creation logic like in RXLContext.js
    static #constructed = false;
   static async create(context, shaderModule, scene, uiManager) {

        const device = context.getDevice();
        const width = context.getCanvas().width;
        const height = context.getCanvas().height;

        //------------------------------
        // Cubemap (todo: move to scene)
        const faceUrls = [
            '../../scenes/skybox/px.png', 
            '../../scenes/skybox/nx.png',
            '../../scenes/skybox/py.png', 
            '../../scenes/skybox/ny.png',
            '../../scenes/skybox/pz.png', 
            '../../scenes/skybox/nz.png'
        ];

        const faceImages = await Promise.all(faceUrls.map(async (url) => {
            const img = new Image();
            img.src = url;
            await img.decode();
            return createImageBitmap(img);
        }));

        const widthCube = faceImages[0].width;
        const heightCube = faceImages[0].height;

        const cubemapTexture = device.createTexture({
            size: [widthCube, heightCube, 6],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST| GPUTextureUsage.RENDER_ATTACHMENT,
            dimension: '2d',
        });

        // Upload each face
        for (let i = 0; i < 6; i++) {
            device.queue.copyExternalImageToTexture(
                { source: faceImages[i] },
                { texture: cubemapTexture, origin: [0, 0, i] },
                [widthCube, heightCube]
            );
        }

        const cubemapSampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            addressModeW: 'clamp-to-edge',
        });


        // -----------------------------
        // Accumulation texture (write-only)
        // -----------------------------
        const accumulationTexture = device.createTexture({
            size: [width, height, 1],
            format: "rgba32float",
            usage: GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
        });


        // -----------------------------
        // Previous accumulation texture (read-only)
        // -----------------------------
        // We want a float texture so we can do averaging in the shader
        const previousAccumTexture = device.createTexture({
            size: [width, height, 1],
            format: "rgba32float", // must be float to allow reading in shader
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST|GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.COPY_SRC,
        }); 

        // uniform buffer
        var uniformBufferSize = 8 + uiManager.getTotalSizeInBytes();
        
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
                // accumulation texture (write-only)
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: { 
                        access: "write-only",
                        format: "rgba32float",
                        viewDimension: "2d",
                    },
                },
                // previous accumulation texture (read-only)
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    texture: {
                        sampleType: "unfilterable-float", // allows reading unnormalized floats
                        viewDimension: "2d",
                    },
                },
                // uniforms
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                        minBindingSize: 24,
                    },
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE ,
                    texture: {
                        viewDimension: 'cube',
                        sampleType: 'float',
                    },
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE ,
                    sampler: {
                        type: 'filtering',
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
        return new Pipeline(pipeline, context, uniformBuffer, previousAccumTexture, accumulationTexture, uiManager, otherBindGroups, cubemapTexture, cubemapSampler);
    }    

    constructor(pipeline, context, uniformBuffer, previousAccumTexture, accumulationTexture, uiManager, otherBindGroups, cubemapTexture, cubemapSampler){
        if(!Pipeline.#constructed){
            throw new Error("Use Pipeline.create() for creating a new pipeline!");
        }
            
        this.#pipeline = pipeline;
        this.#context = context;
        this.#uniformBuffer = uniformBuffer;
        this.#previousAccumTexture = previousAccumTexture;
        this.#accumulationTexture = accumulationTexture;
        this.#uiManager = uiManager;

        this.#otherBindGroups = otherBindGroups;

        this.#cubemapSampler = cubemapSampler;
        this.#cubemapTexture = cubemapTexture;

        this.#spp = 0;

        Pipeline.#constructed = false;
    }

    getPipeline(){
    return this.#pipeline;
    }

    async update(currentTime, deltaTime){
       const [state, size] = this.#uiManager.getState();


        var uniformSize = 2;
        // Iterate through the size Map
        for (const [key, value] of size) {
            uniformSize += value;
        }

        console.log(uniformSize);
        const uniformData = new Float32Array(uniformSize);
        uniformData[0] = currentTime/1000.0;
        uniformData[2] = this.#spp;

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

        
       this.#spp += 1;
        // Todo:
        // this.#scene.update();
    }

   async dispatch() {
    const device = this.#context.getDevice();
    const canvasWidth = this.#context.getCanvas().width;
    const canvasHeight = this.#context.getCanvas().height;

    // Create texture views
    const accumulationView = this.#accumulationTexture.createView(); // write-only
    const previousView = this.#previousAccumTexture.createView();    // read-only

    // Bind group 0: accumulation + previous accumulation + uniform
    const bindGroup = device.createBindGroup({
        layout: this.#pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: accumulationView },
            { binding: 1, resource: previousView },
            { binding: 2, resource: { buffer: this.#uniformBuffer } },
            {
                binding: 3,
                resource: this.#cubemapTexture.createView({ dimension: 'cube' }),
            },
            {
                binding: 4,
                resource: this.#cubemapSampler,
            },
        ],
    });

    // Encode compute pass
    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(this.#pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setBindGroup(1, this.#otherBindGroups[0]);
    pass.setBindGroup(2, this.#otherBindGroups[1]);
    pass.setBindGroup(3, this.#otherBindGroups[2]);

    // Dispatch workgroups
    const workgroupSize = 8;
    pass.dispatchWorkgroups(
        Math.ceil(canvasWidth / workgroupSize),
        Math.ceil(canvasHeight / workgroupSize)
    );
    pass.end();

   // Copy accumulation texture to CPU-readable buffer
    const bytesPerPixel = 16; // RGBA32Float = 4 floats * 4 bytes
    const bytesPerRow = Math.ceil(canvasWidth * bytesPerPixel / 256) * 256;
    const bufferSize = bytesPerRow * canvasHeight;

    const gpuBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    commandEncoder.copyTextureToBuffer(
        { texture: this.#accumulationTexture },
        { buffer: gpuBuffer, bytesPerRow, rowsPerImage: canvasHeight },
        [canvasWidth, canvasHeight, 1]
    );

    // Submit commands
    device.queue.submit([commandEncoder.finish()]);

    // Map GPU buffer
    await gpuBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = gpuBuffer.getMappedRange();

    // Handle per-row padding
    const floatsPerRowPadded = bytesPerRow / 4;
    const floatsPerRow = canvasWidth * 4; // 4 floats per pixel
    const floatDataFull = new Float32Array(arrayBuffer);
    const floatData = new Float32Array(canvasWidth * canvasHeight * 4);

    for (let y = 0; y < canvasHeight; y++) {
        const srcStart = y * floatsPerRowPadded;
        const dstStart = y * floatsPerRow;
        floatData.set(
            floatDataFull.subarray(srcStart, srcStart + floatsPerRow),
            dstStart
        );
    }

    // Convert to Uint8ClampedArray for ImageData
    const data = new Uint8ClampedArray(canvasWidth * canvasHeight * 4);
    for (let i = 0; i < canvasWidth * canvasHeight; i++) {
        const r = Math.min(1.0, floatData[i * 4 + 0]);
        const g = Math.min(1.0, floatData[i * 4 + 1]);
        const b = Math.min(1.0, floatData[i * 4 + 2]);
        const a = Math.min(1.0, floatData[i * 4 + 3]);
        data[i * 4 + 0] = Math.floor(r * 255);
        data[i * 4 + 1] = Math.floor(g * 255);
        data[i * 4 + 2] = Math.floor(b * 255);
        data[i * 4 + 3] = Math.floor(a * 255);
    }

    // Draw to canvas
    const imageData = new ImageData(data, canvasWidth, canvasHeight);
    this.#context.getCanvas().getContext("2d").putImageData(imageData, 0, 0);

    gpuBuffer.unmap();

    // Swap textures for next frame
    [this.#accumulationTexture, this.#previousAccumTexture] =
        [this.#previousAccumTexture, this.#accumulationTexture];
    
    }
 
}
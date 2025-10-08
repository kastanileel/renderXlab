import { RenderObject } from "./RenderObject.js";
import { Shape, Mesh } from "./Shape.js";
import { Material, LambertianDiffuse } from "./Material.js";
import {Camera, PinholeCamera} from "./Camera.js"
import { toWorldTransform } from "../utils/RXLMath.js";

class ShapeInfo{

    constructor(verticesOffset, indicesOffset, verticesCount, indicesCount, shape){
        this.verticesOffset = verticesOffset;
        this.indicesOffset = indicesOffset;
        this.verticesCount = verticesCount;
        this.indicesCount = indicesCount;

        this.matrix = shape.getTransformation();
    }

    verticesOffset;
    indicesOffset;
    verticesCount;
    indicesCount;
    matrix;
};

export class Scene{

    #shapes;
    #materials;
    #camera;

    #sceneInfo;
    #shapeLUTBuffer;
    #shapeLUT;

    #vertices;
    #vertexBuffer;
    #indices;
    #indexBuffer;

    static async create(path, sceneConfig){
        // Todo: parsing

        let teapot = await Mesh.create("../scenes/teapot.obj");
        teapot.setTransformation(toWorldTransform([2.0, 0.0, 0.0], [3.1415, 0.0, 0.0]));

        let cube = await Mesh.create("../scenes/cube.obj");
        cube.setTransformation(toWorldTransform([-6.0, 0.0, 0.0], [1.4, 1.4, 0.0]));

        let shapes = [cube, teapot];
        shapes = [teapot, cube];

        var lambertianDiffuse = new LambertianDiffuse();
        let materials = [lambertianDiffuse];

        var pinhole = await PinholeCamera.create();
        return new Scene(path, sceneConfig, shapes, materials, pinhole);
    }


    constructor(path, sceneConfig, shapes, materials, camera){
        
        this.#shapes = shapes;
        this.#materials = materials;

        this.#camera = camera;

        this.#indices = [];
        this.#vertices = [];
    }

    async build(context) {
        await this.#camera.build(context);

        this.#shapeLUT = [this.#shapes.length];
        var shapeID = 0;
        var verticesOffset = 0;
        var indicesOffset = 0;
        // collect indices and vertices 
        for(const shape of this.#shapes){
            shape.setID(shapeID);
           
            this.#vertices.push(...shape.getVertices());
            this.#indices.push(...shape.getIndices());

            var verticesCount = shape.getVerticesSize();
            var indicesCount = shape.getIndicesSize();

            let shapeInfo = new ShapeInfo(verticesOffset, indicesOffset, verticesCount, indicesCount, shape);
            
            this.#shapeLUT[shapeID] = shapeInfo;

            verticesOffset += verticesCount;
            indicesOffset += indicesCount;

            shapeID ++;
        }

        // building shapeLUT on GPU
        const shapeLUTSize = this.#shapeLUT.length * 20 *4;
        const bufferLUT = new ArrayBuffer(shapeLUTSize);
        const viewLUT = new DataView(bufferLUT);

        var counter = 0;
        for( const entry of this.#shapeLUT){
            viewLUT.setInt32(counter, entry.verticesOffset, true);
            viewLUT.setInt32(counter + 4, entry.indicesOffset, true);
            viewLUT.setInt32(counter + 8, entry.verticesCount, true);
            viewLUT.setInt32(counter + 12, entry.indicesCount, true);

            let transform = entry.matrix.toArray().flat();
            for (let i = 0; i < 16; i++) {
                console.log(transform[i])
                viewLUT.setFloat32(counter + 16 + i * 4, transform[i], true); // offset 16 bytes for floats
            }

            counter += 80;
        }

        this.#shapeLUTBuffer = context.getDevice().createBuffer({
            size: (shapeLUTSize+15) &~15,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        await context.getDevice().queue.writeBuffer(this.#shapeLUTBuffer, 0, bufferLUT);


        // vertex buffer
        const vertexSize = this.#vertices.length * 4 *4;
        this.#vertexBuffer = context.getDevice().createBuffer({
            size: vertexSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const vertexData = new Float32Array(this.#vertices.flat());
        context.getDevice().queue.writeBuffer(this.#vertexBuffer, 0, vertexData);

        // index buffer
        const indexSize = this.#indices.length  *4;
        this.#indexBuffer = context.getDevice().createBuffer({
            size: (indexSize+15)&~15,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const indexData = new Int32Array(this.#indices.flat());
        context.getDevice().queue.writeBuffer(this.#indexBuffer, 0, indexData);

        // todo: lut etc for materials
        for(const material of this.#materials){
            material.build(context);
        }
    }

    async getBindGroupLayouts(context){
        const bindGroupLayouts = [];

        // todo: - make camera responsible for own bind group
        //       - allow for different shape types (spheres, lenses, splines, ...)
        //       - allow for various material types 


        //this.#camera.getBindGroupLayout(context); 
        const bindGroupLayoutCamera = await this.#camera.getBindGroupLayout(context);// await context.getDevice().createBindGroupLayout({ 
            //entries: [
            //    {
            //        binding: 0,
            //        visibility: GPUShaderStage.COMPUTE,
           //         buffer: { type: "storage" } 
            //    }
           // ]
        //});

        const bindGroupLayoutShape = await context.getDevice().createBindGroupLayout({ 
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                },
               /* {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                },*/
            ]
        });

        const bindGroupMaterial = await context.getDevice().createBindGroupLayout({ 
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                }
            ]
        });

        bindGroupLayouts.push(bindGroupLayoutCamera);
        bindGroupLayouts.push(bindGroupLayoutShape);
        bindGroupLayouts.push(bindGroupMaterial);

        return bindGroupLayouts;
   }

    getBindGroups(context, pipeline) {
        const bindGroupCamera = this.#camera.getBindGroup(context, pipeline.getBindGroupLayout(1));    

        const bindGroupShapes = context.getDevice().createBindGroup({
            layout: pipeline.getBindGroupLayout(2),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.#shapeLUTBuffer
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.#vertexBuffer
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.#indexBuffer
                    }
                },
                /*{
                    binding: 3,
                    resource: {
                        buffer: this.#shapes[0].getNormalBuffer()
                    }
                },
                {
                    binding: 4,
                    resource: {
                        buffer: this.#shapes[0].getUVBuffer()
                    }
                },*/
            ]
        });

        const bindGroupMaterials = this.#materials[0].getBindGroup(context, pipeline.getBindGroupLayout(3));    

        return [bindGroupCamera, bindGroupShapes, bindGroupMaterials];
    }
}
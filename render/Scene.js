import { RenderObject } from "./RenderObject.js";
import { Shape, Mesh } from "./Shape.js";
import { Material, LambertianDiffuse } from "./Material.js";
import {Camera, PinholeCamera} from "./Camera.js"

class ShapeInfo{

    constructor(verticesOffset, indicesOffset, verticesCount, indicesCount, shape){
        this.verticesOffset = verticesOffset;
        this.indicesOffset = indicesOffset;
        this.verticesCount = verticesCount;
        this.indicesCount = indicesCount;

        // todo transformation matrix
    }

    verticesOffset;
    indicesOffset;
    verticesCount;
    indicesCount;
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

        let mesh = await Mesh.create("../scenes/teapot.obj");
        let shapes = [mesh];

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
        }

        const shapeLUTSize = this.#shapeLUT.length * 2 *4;
        this.#shapeLUTBuffer = context.getDevice().createBuffer({
            size: (shapeLUTSize+15) &~15,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        const shapeLUTArray = this.#shapeLUT.map(info => [
            info.verticesOffset,
            info.indicesOffset,
            info.verticesCount,
            info.indicesCount
        ]);

        const shapeLUTData = new Int32Array(shapeLUTArray.flat());
        await context.getDevice().queue.writeBuffer(this.#shapeLUTBuffer, 0, shapeLUTData);


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
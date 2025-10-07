import { RenderObject } from "./RenderObject.js";
import { Shape, Mesh } from "./Shape.js";
import { Material, LambertianDiffuse } from "./Material.js";
import {Camera, PinholeCamera} from "./Camera.js"

export class Scene{

    #shapes;
    #materials;
    #camera;

    #sceneInfo;
    #shapeLUT;


    constructor(path, sceneConfig){
        
        this.#shapes = [];
        this.#materials = [];
        
        // Todo: parsing

        // currently constructs a hardcoded triangle
        var cube = new Mesh("cube.obj");
        this.#shapes.push(cube);

        var lambertianDiffuse = new LambertianDiffuse();
        this.#materials.push(lambertianDiffuse);

        this.#camera = new PinholeCamera(); 

        // transfer data to gpu memory


        // create bind groups
    }

    async build(context) {
        await this.#camera.build(context);

        for(const shape of this.#shapes){
            shape.build(context);
        }

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
        const bindGroupLayoutCamera = await context.getDevice().createBindGroupLayout({ 
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                }
            ]
        });

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
                {
                    binding: 3,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: "storage" } 
                },
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
        const bindGroupShapes = this.#shapes[0].getBindGroup(context, pipeline.getBindGroupLayout(2));    
        const bindGroupMaterials = this.#materials[0].getBindGroup(context, pipeline.getBindGroupLayout(3));    

        return [bindGroupCamera, bindGroupShapes, bindGroupMaterials];
    }
}
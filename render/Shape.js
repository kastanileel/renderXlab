import { RenderObject } from "./RenderObject.js";
import { SimpleOBJParser } from "../utils/SimpleOBJParser.js";

export class Shape extends RenderObject{

    #shapeID;

    constructor(){
        super();
        console.log("constructing shape");
    }

    // "virtual" function
    build(context) {
        throw new Error("Shape.build() is a virtual function please override it!");
    }

    getBindGroup(context, layout){
        throw new Error("Shape.getBindGroup() is a virtual function please override it");
    }

    setID(shapeID){
        this.#shapeID = shapeID;
    }
}

export class Mesh extends Shape{

    #vertices;
    #indices;
    #uvCoordinates;
    #normals;

    #vertexBuffer;
    #indexBuffer;
    #uvBuffer;
    #normalBuffer;

    static async create(filePath){
        let parses =  await SimpleOBJParser.parse(filePath);


        let normals = [
            [0, 0, 1.0],
            [0, 0, 1.0],
            [0, 0, 1.0]
        ];

        let uvCoordinates =[
            [0.5, 1.0],
            [0.0, 0.0],
            [1.0, 0.0]
        ];

        return new Mesh(parses.vertices, parses.indices, normals, uvCoordinates);
    }

    constructor(vertices, indices, normals, uvCoordinates){
        super();
       
        this.#vertices = vertices;
        this.#indices = indices;
        this.#normals = normals;
        this.#uvCoordinates = uvCoordinates;
    }

    build(context) {
        // normal buffer
        const normalSize = this.#normals.length * 3 *4;
        this.#normalBuffer = context.getDevice().createBuffer({
            size: normalSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const normalsData = new Float32Array(this.#normals.flat());
        context.getDevice().queue.writeBuffer(this.#normalBuffer, 0, normalsData);

        // uv buffer
        const uvSize = this.#uvCoordinates.length * 2 *4;
        this.#uvBuffer = context.getDevice().createBuffer({
            size: uvSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const uvData = new Float32Array(this.#uvCoordinates.flat());
        context.getDevice().queue.writeBuffer(this.#uvBuffer, 0, uvData);
    }


    getVerticesSize(){
        return this.#vertices.length;
    }

    getIndicesSize(){
        return this.#indices.length;
    }

    getVertices(){
        return this.#vertices;
    } 
    
    getIndices(){
        return this.#indices;
    }

    getNormalBuffer(){
        return this.#normalBuffer;
    }

    getUVBuffer(){
        return this.#uvBuffer;
    }
}
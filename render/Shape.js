import { RenderObject } from "./RenderObject.js";

export class Shape extends RenderObject{
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

    constructor(filePath) {
        super();

        this.#vertices = [
            [0.5, 1.0, 0.0],
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0]
        ];

        this.#indices = [
            [0, 1, 2]
        ];

        this.#normals = [
            [0, 0, 1.0],
            [0, 0, 1.0],
            [0, 0, 1.0]
        ];

        this.#uvCoordinates =[
            [0.5, 1.0],
            [0.0, 0.0],
            [1.0, 0.0]
        ];
    }

    build(context) {

        // vertex buffer
        const vertexSize = this.#vertices.length * 3 *4;
        this.#vertexBuffer = context.getDevice().createBuffer({
            size: vertexSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const vertexData = new Float32Array(this.#vertices.flat());
        context.getDevice().queue.writeBuffer(this.#vertexBuffer, 0, vertexData);

        // index buffer
        const indexSize = this.#indices.length * 3 *4;
        this.#indexBuffer = context.getDevice().createBuffer({
            size: indexSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        const indexData = new Float32Array(this.#indices.flat());
        context.getDevice().queue.writeBuffer(this.#indexBuffer, 0, indexData);

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

    getBindGroup(context, layout){

        const bindGroupShape = context.getDevice().createBindGroup({
            layout: layout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.#vertexBuffer
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.#indexBuffer
                    }
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.#normalBuffer
                    }
                },
                {
                    binding: 3,
                    resource: {
                        buffer: this.#uvBuffer
                    }
                },
            ]
        });

        return bindGroupShape;
    }

}
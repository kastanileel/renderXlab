/*
 * The RXLContext is a structure that wraps essential WebGPU objects.
 *
 * The idea is to group all core components—such as the device, adapter, and canvas—
 * in one place for easier and more organized access.
 *
 * => OOP / Software principle:
 *    Encapsulation of related objects and responsibilities into a single context.
 */

export class RXLContext {
    #canvas;
    #adapter;
    #device;

    // workaround for private constructor
    // => prevent constructor usage because it's not async
    // => async is needed for creating webgpu objects
    static #constructed = false;

    // js does not allow async constructors
    // => use async factory method as workaround
    static async create(canvas){
        this.#constructed = true;

        const adapter = await navigator.gpu?.requestAdapter();
        const device = await adapter?.requestDevice();

        if(!device){
            throw new Error("Your browser/ machine does not support WebGPU, unable to create RXLContext!");
            return;
        }

        return new RXLContext(adapter, device, canvas)
    }

    constructor(adapter, device, canvas){
        if(!RXLContext.#constructed){
            throw new Error("Use RXLContext.create() for creating a new context!");
        }

        this.#adapter = adapter;
        this.#device = device;
        this.#canvas = canvas;
    }

    getDevice() {
        return this.#device;
    }
}
import { RXLContext } from "../../core/rXlContext.js";

export class ShaderModule{

    #module;
    #code;
  
    // same creation logic like in RXLContext.js
    static #constructed = false;
    static async create(context, filepath){
        let module;
        let code;

        ShaderModule.#constructed = true;

        await fetch(filepath)
        .then(shader => shader.text())
        .then(shader => {
            code = shader;
            console.log(shader)
            module = context.getDevice().createShaderModule({
                label: 'test0',
                code: shader,
            });
        });

        return new ShaderModule(module, code)
    }   
    
    constructor(module, code){

        if(!ShaderModule.#constructed){
            throw new Error("Use RXLContext.create() for creating a new shadermodule!");
        }

        this.#module = module;
        this.#code = code;
    }
}
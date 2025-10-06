export class Material {
    constructor() {
        console.log("Material!");
    }
}

export class LambertianDiffuse extends Material{

    #albedo;

    constructor(){
        super();

        this.#albedo = [1.0, 0.0, 0.0];
    }
}
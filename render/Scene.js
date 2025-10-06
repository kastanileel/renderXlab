import { RenderObject } from "./RenderObject.js";
import { Shape, Mesh } from "./Shape.js";
import { Material, LambertianDiffuse } from "./Material.js";
import {Camera, PinholeCamera} from "./Camera.js"

export class Scene{

    #shapes;
    #materials;
    #camera;


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
}
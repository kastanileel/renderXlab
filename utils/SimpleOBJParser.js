export class SimpleOBJParser{

    constructor(){

    };

    static async getObjFile(filePath){
        var obj;

        await fetch(filePath)
        .then(shader => {
            obj = shader.text()
        });

        return obj;
    }

    static async parse(filePath){
        //https://stackoverflow.com/questions/5904230/parsing-obj-3d-graphics-file-with-javascript
        var objText = await SimpleOBJParser.getObjFile(filePath);
        var obj = {};
        var vertexMatches = objText.match(/^v( -?\d+(\.\d+)?){3}$/gm);
        if (vertexMatches)
        {
            obj.vertices = vertexMatches.map(function(vertex)
            {
                // Split by whitespace and remove the "v"
                const parts = vertex.trim().split(/\s+/);
                parts.shift(); 

                const nums = parts.map(parseFloat);
                nums.push(0.0);

                return nums; 
            });
        }

        const faceMatches = objText.match(/^f .+$/gm);
        if (faceMatches) {
            obj.indices = faceMatches.map(face => {
                // Split line, remove "f"
                const parts = face.trim().split(/\s+/);
                parts.shift(); // remove "f"
                // Each face vertex can be like "1", "1/2/3", "1//3"
                return parts.map(p => {
                    const idx = p.split('/')[0]; // only vertex index
                    return parseInt(idx, 10) - 1; // OBJ indices are 1-based
                });
            }).flat(); // flatten if you want a single array of indices
        }

        console.log("obj indices" + obj.indices);
        return {
            vertices: obj.vertices || [],
            indices: obj.indices || []
        };
    }
}
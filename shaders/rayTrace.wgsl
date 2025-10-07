@group(0) @binding(0)
var accumulationTexture: texture_storage_2d<rgba8unorm, write>;

struct Uniforms{
    time: f32,
    slider: f32,
};

@group(0) @binding(1)
var<uniform> params: Uniforms;

//Bind Group 1: Camera

//struct CameraData {
//    x: f32,
//    y: f32,
//    z: f32
//};

@group(1) @binding(0)
var<storage, read_write> cameraData: array<vec4<f32>>;

struct ShapeInfo{
    verticesOffset: i32,
    indicesOffset: i32,
    verticesCount: i32,
    indicesCount: i32
};

@group(2) @binding(0)
var<storage, read_write> shapeInfo: array<ShapeInfo>;

@group(2) @binding(1)
var<storage, read_write> vertices: array<vec3<f32>>;

@group(2) @binding(2)
var<storage, read_write> indices: array<i32>;

//@group(2) @binding(3)
//var<storage, read_write> normals: array<vec3<f32>>;

//@group(2) @binding(4)
//var<storage, read_write> uvCoords: array<vec2<f32>>;

// Bind Group 3: Material
@group(3) @binding(0)
var<storage, read_write> albedo: vec3<f32>;

fn intersect_triangle(o: vec3<f32>, d: vec3<f32>, v0: vec3<f32>, v1: vec3<f32>, v2: vec3<f32>) -> vec3f{
    var e1 = v1- v0;
    var e2 = v2- v0;
    var T = o-v0;

    var P = cross(d, e2);
    var Q = cross(T, e1);

    var det = dot(P, e1);

    let eps = 1e-5;
    //  parallel ray
    if abs(det) < eps {
        return vec3f(-1.0);
    } 
    
    var u = 1.0/det * dot(P, T);
    if (u < -eps) {
        return vec3f(-1.0);
    }

    var v = 1.0/det * dot(Q, d);
    if (v < -eps || (u + v) > 1.0 + eps) {
        return vec3f(-1.0);
    }

    var t = 1.0/det * dot(Q, e2);
    return vec3f(t, u, v);
}


@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3u){
    let dims = vec2u(textureDimensions(accumulationTexture));
    var uv: vec2<f32> = ((vec2<f32>(id.xy) + 0.5) / vec2<f32>(dims)) * 2.0 - 1.0;
    uv.y = -uv.y;

    // Camera position
    let o: vec3<f32> = cameraData[0].xyz;
    var d: vec3<f32> = normalize(vec3<f32>(uv, o.z+0.5 + params.slider) - vec3f(0.0, 0.0, o.z)); 

    var t_min = 10000.0;
    var u = 0.0;
    var v = 0.0;

    //vertexCount = 2;
    for(var triangleID = 0; triangleID < shapeInfo[0].indicesCount; triangleID = triangleID + 3){
        var indx = vec3i(indices[triangleID], indices[triangleID+1], indices[triangleID+2]);
        
        let t = intersect_triangle(o, d, vertices[indx.x],
                                     vertices[indx.y],
                                     vertices[indx.z]);
        if(t.x != -1.0 && t.x < t_min){
            t_min = t.x;
            u = t.y;
            v = t.z;
        }
    }
    var finalColor = vec4f(uv.x, (sin(params.time)+1.0)/2.0, uv.x, 1.0f);

    if(t_min > 0.0 && t_min < 1000){
        finalColor = vec4f(1.0f, 0.0, 0.0, 1.0);//vec4f(u, v, 1.0-u-v, 1.0);
    }
    textureStore(accumulationTexture, vec2i(id.xy), finalColor);
}

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
var<storage, read_write> cameraData: vec3<f32>;

// Bind Group 2: Meshes
@group(2) @binding(0)
var<storage, read_write> vertices: array<vec3<f32>>;

@group(2) @binding(1)
var<storage, read_write> indices: array<vec3<i32>>;

@group(2) @binding(2)
var<storage, read_write> normals: array<vec3<f32>>;

@group(2) @binding(3)
var<storage, read_write> uvCoords: array<vec2<f32>>;

// Bind Group 3: Material
@group(3) @binding(0)
var<storage, read_write> albedo: vec3<f32>;

fn intersect_triangle(o: vec3<f32>, d: vec3<f32>, v0: vec3<f32>, v1: vec3<f32>, v2: vec3<f32>) -> f32{
    var e1 = v1- v0;
    var e2 = v2- v0;
    var T = o-v0;

    var P = cross(d, e2);
    var Q = cross(T, e1);

    var det = dot(P, e1);

    //  parallel ray
    if abs(det) < 0.001{
        return -1.0;
    }
    
    var u = 1.0/det * dot(P, T);
    if(u < 0.0 || u > 1.0){
        return -1.0;
    }

    var v = 1.0/det * dot(Q, d);
    if(v < 0.0 || v > 1.0){
        return -1.0;
    }

    var t = 1.0/det * dot(Q, e2);

    return t;
}


@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3u){
    let dims = vec2u(textureDimensions(accumulationTexture));
    if (id.x >= dims.x || id.y >= dims.y) {
        return;
    }

    let uv = (vec2f(id.xy) - 0.5*vec2f(dims)) / vec2f(dims);

    var o = cameraData;
    var d = normalize(vec3f(uv, 0.0f) - o);

    let t = intersect_triangle(o, d, vec3f(0.0, 0.0f, 0.0),
                                      vec3f(1.0, 0.0, 0.0),
                                      vec3f(0.5, 1.0, 0.0));//vertices[0], vertices[1], vertices[2]); 

    var finalColor = vec4f(uv.x, (sin(params.time)+1.0)/2.0, uv.x, 1.0f);

    if(t > 0.0){
        finalColor = vec4f(albedo, 1.0);
    }

    if(uv.x < (params.slider - 0.5)*2.0){
        finalColor = vec4f(1.0, 0.0, 0.0, 1.0);
    }

    textureStore(accumulationTexture, vec2i(id.xy), finalColor);
}

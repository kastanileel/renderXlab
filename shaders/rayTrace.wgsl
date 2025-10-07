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

fn intersect_triangle(o: vec3<f32>, d: vec3<f32>, v0: vec3<f32>, v1: vec3<f32>, v2: vec3<f32>) -> vec3f{
    var e1 = v1- v0;
    var e2 = v2- v0;
    var T = o-v0;

    var P = cross(d, e2);
    var Q = cross(T, e1);

    var det = dot(P, e1);

    //  parallel ray
    if abs(det) < 0.0001{
        return vec3f(-1.0);
    }
    
    var u = 1.0/det * dot(P, T);
    if(u < 0.0 || u > 1.0){
        return vec3f(-1.0);
    }

    var v = 1.0/det * dot(Q, d);
    if(v < 0.0 || v > 1.0){
        return vec3f(-1.0);
    }

    if(v+u > 1.0){
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
    var d: vec3<f32> = normalize(vec3<f32>(uv, 0.0) - o); 

    let t = intersect_triangle(o, d, vertices[0],
                                     vertices[1],
                                     vertices[2]);

    var finalColor = vec4f(uv.x, (sin(params.time)+1.0)/2.0, uv.x, 1.0f);

    if(t.x > 0.0){
        finalColor = vec4f(t.y, t.z, (1.0-t.y - t.z), 1.0);
    }

    if(uv.x < (params.slider - 0.5)*2.0){
        finalColor = vec4f(1.0, 0.0, 0.0, 1.0);
    }

    textureStore(accumulationTexture, vec2i(id.xy), finalColor);
}

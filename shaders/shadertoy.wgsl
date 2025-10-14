const PI = 3.14159265;

@group(0) @binding(0)
var accumulationTexture: texture_storage_2d<rgba32float, write>;

@group(0) @binding(1)
var previousAccum: texture_2d<f32>; // read-only sampled texture

struct Uniforms{
    time: f32,
    slider: f32,
    frameCount: f32
};

@group(0) @binding(2)
var<uniform> params: Uniforms;

@group(0) @binding(3)
var cubemapTex: texture_cube<f32>;

@group(0) @binding(4)
var cubemapSampler: sampler;

fn sampleSky(rayDir: vec3f) -> vec3f {
    var color = textureSampleLevel(cubemapTex, cubemapSampler, normalize(rayDir), 0.0);
    color = vec4f(vec3f(0.5), 1.0);
    return color.rgb;
}

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
    indicesCount: i32,
    shapeTransform: mat4x4<f32> 
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

struct Ray{
    o: vec3f,
    d: vec3f
};

struct Sphere {
    center: vec3f,
    radius: f32,
    id: i32,
};

struct Hit {
    t: f32,         // Intersection distance along ray
    uv: vec2f,      // Spherical UV coordinates
    normal: vec3f,  // Surface normal at intersection
    id: i32,
};

struct Material{
    materialType: i32,
    albedo: vec3f,
};

struct Payload {
    accumulatedColor: vec3f,
    throughput: vec3f,

    o: vec3f,     // outgoing direction (view dir)
    d: vec3f,

    bounces: i32,
    seed: u32,      // random seed
};

// -----------------------------------------------------------------------------
// Scene setup: 3 spheres
// -----------------------------------------------------------------------------
 /*
const sphereCount = 3u;
const maxBounces = 6;

var<private> spheres: array<Sphere, sphereCount> = array<Sphere, sphereCount>(
    Sphere(vec3f(0.0, 0.0, 0.0), 1.0, 0),
    Sphere(vec3f(0.0, -101.0, 0.0), 100.0, 1),
    Sphere(vec3f(3.0, 3.0, 2.0), 1.0, 2)
);

var<private> materials: array<Material, sphereCount> = array<Material, sphereCount>(
    Material(2, vec3f(0.9, 0.8, 0.05)), // emitter 
    Material(1, vec3f(0.8)), // lambertian diffuse
    Material(0, vec3f(0.0)), // emitter 
);
*/

const sphereCount = 1u;
const maxBounces = 3;

var<private> spheres: array<Sphere, sphereCount> = array<Sphere, sphereCount>(
    Sphere(vec3f(0.0, 0.0, 0.0), 1.0, 0),
);

var<private> materials: array<Material, sphereCount> = array<Material, sphereCount>(
    Material(2, vec3f(1.0))
);// */
// -----------------------------------------------------------------------------
// PCG (permuted congruential generator). Thanks to:
// www.pcg-random.org and www.shadertoy.com/view/XlGcRh
// -----------------------------------------------------------------------------
// PCG (Permuted Congruential Generator) for WGSL
// -----------------------------------------------------------------------------
// Reference: www.pcg-random.org and Shadertoy: XlGcRh

fn NextRandom(state: ptr<function, u32>) -> u32 {
    // Advance the state
    (*state) = (*state) * 747796405u + 2891336453u;

    // Permutation
    var result: u32 = ((*state) >> (((*state) >> 28u) + 4u)) ^ (*state);
    result = result * 277803737u;
    result = (result >> 22u) ^ result;

    return result;
}

fn RandomValue(state: ptr<function, u32>) -> f32 {
    let r: u32 = NextRandom(state);
    return f32(r) / 4294967295.0; // normalize to [0,1]
}


// -----------------------------------------------------------------------------
// Cosine-weighted hemisphere sampling around normal
// -----------------------------------------------------------------------------
fn sample(matID: i32, w_o: vec3f, normal: vec3f, pdf: ptr<function, f32>, seed: ptr<function, u32>) -> vec3f {

    var rr = vec2f(RandomValue(seed), RandomValue(seed));
  
    var x = cos(2.0f*PI*rr.x) * 2.0f * sqrt(rr.y*(1.0-rr.y));
    var y = sin(2.0f*PI*rr.x) * 2.0f * sqrt(rr.y*(1.0-rr.y));
    var z = 1.0 - 2.0*rr.y;

    // PDF for uniform hemisphere
    *pdf =  max(0.0001, 1.0/(2.0*PI));
    var w_i = normalize(vec3f(x, y, z));

    if(dot(w_i, normal) <= 0.0){
        w_i = -w_i;
    }

    return w_i;
}

// -----------------------------------------------------------------------------
// Lambertian diffuse BRDF evaluation
// -----------------------------------------------------------------------------
fn evaluateLambertian(matID: i32, w_o: vec3f, normal: vec3f, w_i: vec3f, uv:vec2f) -> vec3f {
    let mat = materials[matID];
    // Lambertian: f = albedo / PI
    //if((i32(uv.y*1000.0) % 2 == 0)  != (i32(uv.x*10.0)%2 == 0)){
    //    return vec3f(0.4)/3.14159265;
   // }
    return mat.albedo / 3.14159265;
}

// sampling of principled

fn samplePrincipled(matID: i32, w_o: vec3f, normal: vec3f, pdf: ptr<function, f32>, seed: ptr<function, u32>) -> vec3f {
    // Generate two random numbers in [0,1)
    var rr = vec2f(RandomValue(seed), RandomValue(seed));
  
    var x = cos(2.0f*PI*rr.x) * 2.0f * sqrt(rr.y*(1.0-rr.y));
    var y = sin(2.0f*PI*rr.x) * 2.0f * sqrt(rr.y*(1.0-rr.y));
    var z = 1.0 - 2.0*rr.y;

    // PDF for uniform hemisphere
    *pdf =  max(0.0001, 1.0/(2.0*PI));
    var w_i = normalize(vec3f(x, y, z));

    if(dot(w_i, normal) < 0.0){
        w_i = -w_i;
    }
    return w_i;
}

fn safeVec3(v: vec3f, fallback: vec3f) -> vec3f {
    // WGSL-safe NaN check: replace NaNs with fallback
    let nanMask = vec3<bool>(
        !(v.x == v.x),
        !(v.y == v.y),
        !(v.z == v.z)
    );
    return select(v, fallback, nanMask);
}

fn F_Schlick(VdotH: f32) -> f32{
    var etaRatio = 1.5;
    var r0 = pow((1.0-etaRatio)/(1.0+etaRatio), 2.0); 
    return r0 + (1.0-r0)*(pow(1.0-VdotH, 5.0));
}

fn GGX(NdotH: f32, roughness: f32) -> f32 {
    let alpha = roughness * roughness;
    let alpha2 = alpha * alpha;
    let denom = (NdotH * NdotH) * (alpha2 - 1.0) + 1.0;
    return alpha2 / (3.14159265 * denom * denom);
}

fn G_SchlickGGX(NdotX: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;
    return NdotX / (NdotX * (1.0 - k) + k);
}

fn G_Smith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
    let gv = G_SchlickGGX(NdotV, roughness);
    let gl = G_SchlickGGX(NdotL, roughness);
    return gv * gl;
}



fn evaluatePrincipled(matID: i32, w_o: vec3f, normal: vec3f, w_i: vec3f, uv: vec2f) -> vec3f {

    if(dot(normalize(w_o), normal)> 0.0){
        return vec3f(1.0, 0.0, 1.0);
    }
    return vec3f(0.0, 1.0, 0.0);
    /*let mat = materials[matID];
    let baseColor = mat.albedo;
    let roughness = params.slider;



    let L = normalize(w_i);
    let H = normalize(V + L);

    let NdotL = dot(N, L);
    let NdotV = dot(N, V);
    let NdotH = max(dot(N, H), 0.0);
    let VdotH = max(dot(V, H), 0.0);
    let LdotH = max(dot(L, H), 0.0);


    // --- Disney Diffuse (Burley 2012) ---
    var vis = 1.0;
    if( NdotV <= 0.0){
        //vis = 0.0;
    }
    var energyBias = mix(0.0, 0.5, roughness);
    var energyFactor = mix(1.0, 1.0/1.51, roughness);
    var FD90 = energyBias + 2.0 * LdotH * LdotH * roughness;
    var FdV = 1.0 + (FD90 - 1.0) * pow(1.0 - NdotV, 5.0);
    var FdL = 1.0 + (FD90 - 1.0) * pow(1.0 - NdotL, 5.0);
    var f_baseDiffuse = baseColor / 3.14159265 * FdV * FdL * energyFactor * vis;

    // --- Cook-Torrance Specular ---
    let F =1.0;// //F_Schlick(VdotH);
    let D = GGX(NdotH, roughness);
    let G = 1.0;//G_Smith(NdotV, NdotL, roughness);
    let f_metal = (F * G * D);// / (4.0 * max(NdotL * NdotV, 0.001));

    return  f_baseDiffuse;*/
}


fn raygen( fov: f32, uv: vec2f) -> Ray {

    // Camera origin
    let o: vec3f = cameraData[0].xyz;

    let fovRad = radians(fov);
    let scale = tan(fovRad * 0.5);

    var d = -normalize(vec3f(uv.x * scale, uv.y * scale, 1.0));

    let angle = radians(-15.0);
    let cosA = cos(angle);
    let sinA = sin(angle);

    // Rotation around X axis:
    // y' = y*cosθ - z*sinθ
    // z' = y*sinθ + z*cosθ
    let y = d.y * cosA - d.z * sinA;
    let z = d.y * sinA + d.z * cosA;
    d = normalize(vec3f(d.x, y, z));

    return Ray(o, d);

}

// Returns a Hit struct; if no hit, t = -1.0
fn intersect_sphere(ray: Ray, sphere: Sphere) -> Hit {
    let ray_orig = ray.o;
    let ray_dir = ray.d;
    let oc = ray_orig - sphere.center;

    let a = dot(ray_dir, ray_dir);
    let b = 2.0 * dot(oc, ray_dir);
    let c = dot(oc, oc) - sphere.radius * sphere.radius;
    let disc = b*b - 4.0*a*c;

    if (disc < 0.0) {
        return Hit(-1.0, vec2f(0.0), vec3f(0.0), sphere.id);
    }

    let sqrt_disc = sqrt(disc);
    var t = (-b - sqrt_disc) / (2.0 * a);
    if (t < 0.0) {
        t = (-b + sqrt_disc) / (2.0 * a);
        if (t < 0.0) {
            return Hit(-1.0, vec2f(0.0), vec3f(0.0), sphere.id);
        }
    }

    let hit_pos = ray_orig + t * ray_dir;
    let normal = normalize(hit_pos - sphere.center);

    // Spherical UV coordinates
    let u = 0.5 + atan2(normal.z, normal.x) / (2.0 * 3.14159265);
    let v = 0.5 - asin(normal.y) / 3.14159265;

    return Hit(t, vec2f(u, v), normal, sphere.id);
}

fn chit(hit: Hit, payload: ptr<function, Payload>){

    // emitter
    if (materials[hit.id].materialType == 0) {
        (*payload).accumulatedColor = (*payload).throughput * materials[hit.id].albedo;
        (*payload).bounces = maxBounces;
        return;
    }

    var pdf_bsdf: f32 = 0.0;
    var w_i: vec3f;
    var f: vec3f;
    if(materials[hit.id].materialType == 1 ){
        w_i = normalize(sample(hit.id, -(*payload).d, hit.normal, &pdf_bsdf, &(*payload).seed));
        f = evaluateLambertian(hit.id, -(*payload).d, hit.normal, w_i, hit.uv);
    }
    if(materials[hit.id].materialType == 2){
        w_i = normalize(samplePrincipled(hit.id, -(*payload).d, hit.normal, &pdf_bsdf, &(*payload).seed));
        f = evaluatePrincipled(hit.id, -(*payload).d, hit.normal, w_i, hit.uv);
    }

    var cosThetaI = max(0.001, dot(hit.normal, w_i));
    (*payload).d = w_i;
    //cosThetaI = 1.0;
    (*payload).throughput *= f * cosThetaI / pdf_bsdf;
}

fn intersectScene(ray: Ray) -> Hit {
    var hit: Hit;
    hit.t = 1e9;      // large number = "no hit"
    hit.id = -1;

    for (var i: u32 = 0u; i < sphereCount; i = i + 1u) {
        let t = intersect_sphere(ray, spheres[i]);
        if (t.t > 0.0 && t.t < hit.t) {
            hit = t;
            hit.id = spheres[i].id;
        }
    }

    return hit;
}


@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3u){
    
    let dims = vec2u(textureDimensions(accumulationTexture));
    var seed: u32 = id.x + (id.y*1000) * dims.x + u32(params.frameCount) * 17u;

    // Mix bits with some primes and XOR with time
    seed = seed * 747796405u + 2891336453u;
    seed = (seed >> ((seed >> 28u) + 4u)) ^ seed;
    seed = seed * 277803737u;
    seed = (seed >> 22u) ^ seed;

    // Optional: mix in time
    seed = seed ^ u32(params.time * 100384970.0);


    var uv: vec2<f32> = ((vec2<f32>(id.xy) + 0.5) / vec2<f32>(dims)) * 2.0 - 1.0;
    uv.x = uv.x *800/600;

    // Camera position
    let ray = raygen(50, uv);

    var payload = Payload();
    payload.accumulatedColor = vec3f(0.0);
    payload.throughput = vec3(1.0);
    payload.seed = u32(seed);
    payload.o = ray.o;
    payload.d = ray.d;
 
    payload.bounces = 0;

    for(var i = 0; i < maxBounces; i ++){
        var hit = intersectScene(Ray(payload.o, payload.d)); 

        var p = payload.d * hit.t + payload.o;
        // miss
        if((hit.t <= .0 || hit.t>=1e9 )){
            payload.accumulatedColor = sampleSky(payload.d) * payload.throughput; 
            break;
        }

        if(i == 1){
            payload.accumulatedColor = (hit.normal + 1.0)/2.0;
            break;
        }

        chit(hit, &payload);
        
        payload.o = p + 0.001 * payload.d;
    
        if(payload.bounces >= maxBounces){
            break;
        }

    }

   // payload.accumulatedColor = safeVec3(payload.accumulatedColor, vec3f(1.0, 0.0, 0.0));


    var prevColor: vec4f = textureLoad(previousAccum, vec2i(id.xy), 0);
    var newColor = (prevColor.xyz * f32(params.frameCount - 1.0) + payload.accumulatedColor) / f32(params.frameCount);
    //var newColor = (prevColor.xyz * f32(1000.0 - 1.0) + payload.accumulatedColor) / f32(1000.0);
    
    if(params.frameCount == 0.0){
        newColor = payload.accumulatedColor;
    }

   // newColor = vec3f(RandomValue(&seed));
    textureStore(accumulationTexture, vec2i(id.xy), vec4f(newColor, 1.0)); 

//    textureStore(accumulationTexture, vec2i(id.xy), vec4f(col, 1.0)); 
}


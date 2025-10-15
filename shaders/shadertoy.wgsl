const PI = 3.14159265;

@group(0) @binding(0)
var accumulationTexture: texture_storage_2d<rgba32float, write>;

@group(0) @binding(1)
var previousAccum: texture_2d<f32>; // read-only sampled texture

struct Uniforms{
    time: f32,
    roughnessX: f32,
    frameCount: f32,
    roughnessY: f32,
    metalness: f32,
};

@group(0) @binding(2)
var<uniform> params: Uniforms;

@group(0) @binding(3)
var cubemapTex: texture_cube<f32>;

@group(0) @binding(4)
var cubemapSampler: sampler;

fn sampleSky(rayDir: vec3f) -> vec3f {
    var color = textureSampleLevel(cubemapTex, cubemapSampler, normalize(rayDir), 0.0);
    //color = vec4f(vec3f(0.5), 1.0);
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
// /*
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
    Material(0, vec3f(5.0)), // emitter 
);
/*

const sphereCount = 1u;
const maxBounces = 3;

var<private> spheres: array<Sphere, sphereCount> = array<Sphere, sphereCount>(
    Sphere(vec3f(0.0, 0.0, 0.0), 1.0, 0),
);

var<private> materials: array<Material, sphereCount> = array<Material, sphereCount>(
    Material(2, vec3f(1.0))
); */
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
fn tangent_to_world(N: vec3<f32>) -> mat3x3<f32> {
    // Pick a helper 'up' vector to avoid degeneracy
    let up: vec3<f32> = select(
        vec3<f32>(0.0, 0.0, 1.0),
        vec3<f32>(1.0, 0.0, 0.0),
        abs(N.z) >= 0.999
    );

    let tangent: vec3<f32> = normalize(cross(up, N));
    let bitangent: vec3<f32> = cross(N, tangent);

    // Return the TBN matrix (columns are tangent space axes)
    return mat3x3<f32>(tangent, bitangent, N);
}

fn ggx_pdf(N: vec3<f32>, V: vec3<f32>, h: vec3<f32>, alpha: f32) -> f32 {
    let NoH = max(dot(N, h), 0.0);
    let VoH = max(dot(V, h), 0.0);

    // GGX NDF
    let a2 = alpha * alpha;
    let denom = (NoH * NoH) * (a2 - 1.0) + 1.0;
    let D = a2 / (PI * denom * denom);

    // PDF over light direction
    return (D * NoH) / (4.0 * VoH);
}

fn ggx_ansio_pdf(N: vec3<f32>, V: vec3<f32>, h: vec3<f32>, alphaX: f32, alphaY: f32) -> f32 {
    let NoH = max(dot(N, h), 0.0);
    let VoH = max(dot(V, h), 0.0);

    // GGX NDF
    let D = GGX_aniso(N, h, alphaX, alphaY);

    // PDF over light direction
    return (D * NoH) / (4.0 * VoH);
}
fn samplePrincipled(matID: i32, w_o: vec3f, normal: vec3f, pdf: ptr<function, f32>, seed: ptr<function, u32>) -> vec3f {
    //GGX sampling
    let roughnessX = max(0.001, params.roughnessX);
    let roughnessY = max(0.001, params.roughnessY);
    let roughness = (roughnessX + roughnessY)/ 2.0;

    let metalness = params.metalness;

    if(RandomValue(seed) > metalness){
        var rr = vec2f(RandomValue(seed), RandomValue(seed));
  
        var x = cos(2.0f*PI*rr.x) * 2.0f * sqrt(rr.y*(1.0-rr.y));
        var y = sin(2.0f*PI*rr.x) * 2.0f * sqrt(rr.y*(1.0-rr.y));
        var z = 1.0 - 2.0*rr.y;

        // PDF for uniform hemisphere
        var pd = 1.0 / (2.0 * PI);        // hemisphere uniform in your branch
        *pdf = max(1e-6f, (1.0 - metalness) * pd);  // <-- mixture pdf 
        var w_i = normalize(vec3f(x, y, z));

        if(dot(w_i, normal) <= 0.0){
            w_i = -w_i;
        }

        return w_i;

    } 


    // GGX importance sampling of the half-vector
    // sampling GGX
    var epsilon = RandomValue(seed);
    var theta_m = acos(
        sqrt(
            (1.0-epsilon)/
            (epsilon * (roughness*roughness-1.0) + 1.0)
        )
    );
    var azimuth = RandomValue(seed) * 2.0 *PI;

    // creating H local
    var cosTheta = cos(theta_m);
    var sinTheta = sin(theta_m);
    var h_local = vec3f(
        sinTheta * cos(azimuth) * roughnessX,
        sinTheta * sin(azimuth) * roughnessY,
        cosTheta
    );

    // transforming h local
    let TBN = tangent_to_world(normal); 
    var H = normalize(TBN * h_local);

    var ps = ggx_ansio_pdf(normal, w_o, H, roughnessX, roughnessY);
    *pdf = max(1e-6f, metalness * ps);   
    //*pdf = mix(metalness, 1.0/(2.0*PI), max(0.001, ggx_pdf(normal, w_o, H, roughness)));

    return normalize(reflect(-w_o, H));

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

fn F_Schlick(VdotH: f32, f0: f32) -> f32{
    // assumes ior of 1.5
    return f0 + (1.0-f0)*(pow(1.0-VdotH, 5.0));
}

fn GGX(n: vec3f, h:vec3f, roughness: f32) -> f32{
    var sqr_rough = roughness * roughness;
    var NdotH = dot(n, h);
    var sqrt_denom = NdotH * NdotH * (sqr_rough-1.0) + 1.0;
    return (sqr_rough)/(PI * sqrt_denom * sqrt_denom);
}

fn makeTangent(n: vec3f) -> vec3f{
    var t = vec3f(1.0, 0.0, 0.0);
    if(dot(n, t) > 0.999){
        t = vec3f(0.0, 1.0, 0.0);
    }

    return normalize(cross(t, n));
}

fn GGX_aniso(n:vec3f, h:vec3f, roughnessX: f32, roughnessY: f32)-> f32{
    var NdotH = dot(n, h);

    var tangent = makeTangent(n);
    var bitangent = normalize(cross(n, tangent));

    // azimut phi stuff:
    let Ht = vec3f(dot(h, tangent), dot(h, bitangent), dot(h, n)); // h in tangent space
    let cosPhi = Ht.x / sqrt(Ht.x*Ht.x + Ht.y*Ht.y + 1e-7);
    let sinPhi = Ht.y / sqrt(Ht.x*Ht.x + Ht.y*Ht.y + 1e-7); 

    // anisotropic factor:
    var a = (cosPhi*cosPhi) / (roughnessX*roughnessX) + (sinPhi*sinPhi) / (roughnessY*roughnessY);

    var sqrt_denom = 1.0 + ((1.0-NdotH*NdotH)/(NdotH * NdotH)) * a;
    return max(0.00, 1.0/(PI*roughnessX*roughnessY * pow(NdotH, 4.0) * sqrt_denom*sqrt_denom));
}

fn GeometrySchlickGGX(NdotV: f32, k: f32)-> f32
{
    var nom   = NdotV;
    var denom = NdotV * (1.0 - k) + k;
	
    return nom / denom;
}
  
fn GeometrySmith(N: vec3f, V: vec3f, L: vec3f, k: f32) -> f32
{
    var NdotV = max(dot(N, V), 0.0);
    var NdotL = max(dot(N, L), 0.0);
    var ggx1 = GeometrySchlickGGX(NdotV, k);
    var ggx2 = GeometrySchlickGGX(NdotL, k);
	
    return ggx1 * ggx2;
}

fn evaluatePrincipled(matID: i32, w_o: vec3f, normal: vec3f, w_i: vec3f, uv: vec2f) -> vec3f {
    let mat = materials[matID];
    let baseColor = mat.albedo;

    let roughnessX = max(0.001, params.roughnessX);
    let roughnessY = max(0.001, params.roughnessY);
    let roughness = (roughnessX + roughnessY)/ 2.0;
    let metalness = params.metalness;

    // --- diffuse
   var f_baseDiffuse = baseColor / 3.14159265;

    var NdotV = dot(normal, w_o);
    var NdotL = dot(normal, w_i);
    var H = normalize(w_o + w_i);
    // --- Cook-Torrance Specular ---

    //assume ior = 1.5
    var F0 = (0.04);
    F0 = mix(F0, 1.0, metalness);
    let F = F_Schlick(dot(w_o, H), F0);

    var D = 
    GGX_aniso(normal, H, roughnessX, roughnessY);
    //GGX(normal, H, roughness);
    if(!(D == D)){
        D = 0.0;
    }
    D = abs(D);

    // mapping
    let k = roughness/2.0;//*roughness;
    let G = GeometrySmith(normal, w_o, w_i, k);
    
    let f_metal = (F * G * D) / (4.0 * max(NdotL * NdotV, 0.001));

    // --- refraction (rough dielectric)

    return f_metal * baseColor * metalness + (1.0-metalness)*f_baseDiffuse;
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

    if(dot(normal, ray.d) > 0.0){
        return Hit(-1.0, vec2f(0.0), vec3f(0.0), sphere.id);
    }

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
    seed = seed ^ u32(params.time * 1003.0);


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


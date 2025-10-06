[[group(0), binding(0)]]
var accumulationTexture: texture_storage_2d<rgba8unorm, write>;

struct Uniforms{
    time: f32
};

[[group(0), binding(0)]]
var<uniform> params: Uniforms;

[[stage(compute)]]
fn main(@builtin(global_invocation_id) id : vec3u){
    let dims = vec2u(textureDimensions(outputTex));
    if (id.x >= dims.x || id.y >= dims.y) {
        return;
    }

    let uv = (vec2f(id.xy) - 0.5*vec2f(dims)) / vec2f(dims);

    finalColor = vec4f(0.0, (sin(params.time)+1.0)/2.0, uv.x, uv.y);

    textureStore(outputTex, vec2i(id.xy), finalColor);
}



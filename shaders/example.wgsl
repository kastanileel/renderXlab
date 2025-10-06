@group(0) @binding(0)
var accumulationTexture: texture_storage_2d<rgba8unorm, write>;

struct Uniforms{
    time: f32,
    slider: f32,
};

@group(0) @binding(1)
var<uniform> params: Uniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3u){
    let dims = vec2u(textureDimensions(accumulationTexture));
    if (id.x >= dims.x || id.y >= dims.y) {
        return;
    }

    let uv = (vec2f(id.xy) - 0.5*vec2f(dims)) / vec2f(dims);
    var finalColor = vec4f(uv.x, (sin(params.time)+1.0)/2.0, uv.x, 1.0f);

    if(uv.x < (params.slider - 0.5)*2.0){
        finalColor = vec4f(1.0, 0.0, 0.0, 1.0);
    }

    textureStore(accumulationTexture, vec2i(id.xy), finalColor);
}

# renderXlab
A lightweight WebGPU framework for modern path tracing algorithms and rendering research in the browser. Includes an example library of implemented papers and interactive demos.

# motivation:
I love prototyping PBR research and papers in Shadertoy. However, working only with fragment shaders feels a bit limiting. I also don’t like relying on a third party to host my shaders or store them.

## Todo v0.9:
- [x] core handling webgpu stuff
- [x] api for easy use
- [x] simple ui library for interactions
- [ ] rendering core: scene that helps allocating buffers etc.
- [ ] obj parser (only meshes)
- [ ] shape -> material mapping
- [ ] example using the framework and implementing mis from e. veach
- [ ] link ui not only to uniform data
- [ ] add an abstraction for reading shaders: Make a Source class, this class could be a .wgsl file but also text split over multiple  html textareas => nice for writing a blog post/ explaining the implementation.
    
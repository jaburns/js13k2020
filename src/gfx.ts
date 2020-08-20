import { standard_vert, normals_frag } from "./shaders.gen";
import { DEBUG } from "./debug.gen";

declare const a: HTMLCanvasElement;
declare const g: WebGLRenderingContext;

type Model =
{
    vertexBuffer: WebGLBuffer,
    normalBuffer?: WebGLBuffer,
    indexBuffer: WebGLBuffer,
};

const createCubeModel = (): Model =>
{
    const result = {
        vertexBuffer: g.createBuffer()!,
        normalBuffer: g.createBuffer()!,
        indexBuffer: g.createBuffer()!,
    };

    // TODO cube
    const verts = [0,0,0];
    const norms = [0,0,0];
    const tris = [0];

    g.bindBuffer(g.ARRAY_BUFFER, result.vertexBuffer);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array(verts), g.STATIC_DRAW);
    g.bindBuffer(g.ARRAY_BUFFER, result.normalBuffer);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array(norms), g.STATIC_DRAW);
    g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, result.indexBuffer);
    g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(tris), g.STATIC_DRAW);

    return result;
};

const onResize = () =>
    g.viewport( 0, 0, a.width = window.innerWidth, a.height = window.innerHeight );

export const gfxInit = () =>
{
    window.onresize = onResize;

    onResize();

    g.clearColor(0,1,0,1);
    g.clear(g.COLOR_BUFFER_BIT);

    gfxBuildProgram( standard_vert, normals_frag );
    createCubeModel();
};

export const gfxBuildProgram = ( vert: string, frag: string ): WebGLProgram =>
{
    const vs = g.createShader( g.VERTEX_SHADER )!;
    g.shaderSource( vs, vert );
    g.compileShader( vs );

    if( DEBUG )
    {
        let log = g.getShaderInfoLog(vs);
        if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
            console.error( 'Vertex shader error', log, vert );
    }

    const fs = g.createShader( g.FRAGMENT_SHADER )!;
    g.shaderSource( fs, 'precision highp float;' + frag );
    g.compileShader( fs );

    if( DEBUG )
    {
        let log = g.getShaderInfoLog(fs);
        if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
            console.error( 'Fragment shader error', log, fs );
    }

    const prog = g.createProgram()!;
    g.attachShader( prog, vs );
    g.attachShader( prog, fs );
    g.linkProgram( prog );

    return prog;
};

export const gfxDrawCube = ( t: number ) =>
{

};
import { standard_vert, normals_frag } from "./shaders.gen";
import { DEBUG } from "./debug.gen";

declare const a: HTMLCanvasElement;
declare const g: WebGLRenderingContext;

const onResize = () =>
    g.viewport( 0, 0, a.width = window.innerWidth, a.height = window.innerHeight );

export const gfxInit = () =>
{
    window.onresize = onResize;

    onResize();

    g.clearColor(0,1,0,1);
    g.clear(g.COLOR_BUFFER_BIT);

    gfxBuildProgram( standard_vert, normals_frag );
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
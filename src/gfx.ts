import { main_vert, main_frag } from "./shaders.gen";
import { GameState } from "./state";
import { DEBUG } from "./debug.gen";

// https://www.shadertoy.com/view/Ms23DR

declare const a: HTMLCanvasElement;
declare const g: WebGLRenderingContext;

let _fullScreenQuadVertBuffer: WebGLBuffer;
let _shader: WebGLProgram;

//let onResize = () =>
//    g.viewport( 0, 0, a.width = window.innerWidth, a.height = window.innerHeight );

// Init
{
    let vert = main_vert;
    let frag = main_frag;

    let vs = g.createShader( g.VERTEX_SHADER )!;
    g.shaderSource( vs, vert );
    g.compileShader( vs );

    if( DEBUG )
    {
        let log = g.getShaderInfoLog(vs);
        if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
            console.error( 'Vertex shader error', log, vert );
    }

    let fs = g.createShader( g.FRAGMENT_SHADER )!;
    g.shaderSource( fs, frag );
    g.compileShader( fs );

    if( DEBUG )
    {
        let log = g.getShaderInfoLog(fs);
        if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
            console.error( 'Fragment shader error', log, fs );
    }

    _shader = g.createProgram()!;
    g.attachShader( _shader, vs );
    g.attachShader( _shader, fs );
    g.linkProgram( _shader );

    _fullScreenQuadVertBuffer = g.createBuffer()!;
    g.bindBuffer( g.ARRAY_BUFFER, _fullScreenQuadVertBuffer );
    g.bufferData( g.ARRAY_BUFFER, Uint8Array.of(1, 1, 1, 128, 128, 1), g.STATIC_DRAW );

    g.viewport( 0, 0, 320, 240 );
}

export let gfxDrawGame = ( prevState: GameState, curState: GameState, lerpTime: number ) =>
{
    let t = curState.tick + (curState.tick - prevState.tick) * lerpTime;

    g.useProgram( _shader );

    g.uniform2f( g.getUniformLocation( _shader, 'u_resolution' ), 320, 240 );
    g.uniform1f( g.getUniformLocation( _shader, 'u_time' ), t / 30 );

    g.bindBuffer( g.ARRAY_BUFFER, _fullScreenQuadVertBuffer );
    let posLoc = g.getAttribLocation( _shader, 'a_position' );
    g.enableVertexAttribArray( posLoc );
    g.vertexAttribPointer( posLoc, 2, g.BYTE, false, 0, 0 );

    g.drawArrays( g.TRIANGLES, 0, 3 );
};
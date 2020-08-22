import { main_vert, main_frag, post_frag } from "./shaders.gen";
import { GameState } from "./state";
import { DEBUG } from "./debug.gen";
import { gl_VERTEX_SHADER, gl_FRAGMENT_SHADER, gl_ARRAY_BUFFER, gl_STATIC_DRAW, gl_FRAMEBUFFER, gl_TEXTURE_2D, gl_RGBA, gl_UNSIGNED_BYTE, gl_LINEAR, gl_CLAMP_TO_EDGE, gl_TEXTURE_WRAP_S, gl_TEXTURE_WRAP_T, gl_TEXTURE_MIN_FILTER, gl_COLOR_ATTACHMENT0, gl_NEAREST, gl_FLOAT, gl_TRIANGLES, gl_BYTE, gl_TEXTURE0 } from "./glConsts";

const MAIN_WIDTH = 512; const MAIN_HEIGHT = 384;
//const MAIN_WIDTH = 320; const MAIN_HEIGHT = 240;
const OUT_WIDTH = 1024;
const OUT_HEIGHT = 768;
const SDF_SAMPLE_WIDTH = 1;
const SDF_SAMPLE_HEIGHT = 1;

declare const a: HTMLCanvasElement;
declare const g: WebGLRenderingContext;

let _fullScreenQuadVertBuffer: WebGLBuffer;

let _mainShader: WebGLProgram;
let _postShader: WebGLProgram;

let _framebuffer: WebGLFramebuffer;
let _framebufferTexture: WebGLTexture;

let _sdfSampleFramebuffer: WebGLFramebuffer;
let _sdfSampleFramebufferTexture: WebGLTexture;

export let sdfSampleResults: Float32Array = new Float32Array( 4 * SDF_SAMPLE_WIDTH * SDF_SAMPLE_HEIGHT );

let buildShader = ( vert: string, frag: string ): WebGLProgram =>
{
    let vs = g.createShader( gl_VERTEX_SHADER )!;
    g.shaderSource( vs, vert );
    g.compileShader( vs );

    if( DEBUG )
    {
        let log = g.getShaderInfoLog(vs);
        if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
            console.error( 'Vertex shader error', log, vert );
    }

    let fs = g.createShader( gl_FRAGMENT_SHADER )!;
    g.shaderSource( fs, frag );
    g.compileShader( fs );

    if( DEBUG )
    {
        let log = g.getShaderInfoLog(fs);
        if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
            console.error( 'Fragment shader error', log, fs );
    }

    let ss = g.createProgram()!;
    g.attachShader( ss, vs );
    g.attachShader( ss, fs );
    g.linkProgram( ss );

    return ss;
};

// Init
{
    g.getExtension('OES_texture_float');

    _mainShader = buildShader( main_vert, main_frag );
    _postShader = buildShader( main_vert, post_frag );

    _fullScreenQuadVertBuffer = g.createBuffer()!;
    g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenQuadVertBuffer );
    g.bufferData( gl_ARRAY_BUFFER, Uint8Array.of(1, 1, 1, 128, 128, 1), gl_STATIC_DRAW );

    {
        _framebuffer = g.createFramebuffer()!;
        g.bindFramebuffer( gl_FRAMEBUFFER, _framebuffer );

        _framebufferTexture = g.createTexture()!;
        g.bindTexture( gl_TEXTURE_2D, _framebufferTexture );
        g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, MAIN_WIDTH, MAIN_HEIGHT, 0, gl_RGBA, gl_UNSIGNED_BYTE, null );

        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
        g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, _framebufferTexture, 0 );
    }

    {
        _sdfSampleFramebuffer = g.createFramebuffer()!;
        g.bindFramebuffer( gl_FRAMEBUFFER, _sdfSampleFramebuffer );

        _sdfSampleFramebufferTexture = g.createTexture()!;
        g.bindTexture( gl_TEXTURE_2D, _sdfSampleFramebufferTexture );
        g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, SDF_SAMPLE_WIDTH, SDF_SAMPLE_HEIGHT, 0, gl_RGBA, gl_FLOAT, null );

        g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, _sdfSampleFramebufferTexture, 0 );
    }
}

let fullScreenDraw = ( shader: WebGLProgram ) =>
{
    g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenQuadVertBuffer );
    let posLoc = g.getAttribLocation( shader, 'a_position' );
    g.enableVertexAttribArray( posLoc );
    g.vertexAttribPointer( posLoc, 2, gl_BYTE, false, 0, 0 );
    g.drawArrays( gl_TRIANGLES, 0, 3 );
};

export let gfxSampleSDF = () =>
{
    g.useProgram( _mainShader );
    g.bindFramebuffer( gl_FRAMEBUFFER, _sdfSampleFramebuffer );
    g.viewport( 0, 0, SDF_SAMPLE_WIDTH, SDF_SAMPLE_HEIGHT );
    g.uniform1i( g.getUniformLocation( _mainShader, 'u_enableSampleMode' ), 1 );
    fullScreenDraw( _mainShader );
    g.readPixels( 0, 0, SDF_SAMPLE_WIDTH, SDF_SAMPLE_HEIGHT, gl_RGBA, gl_FLOAT, sdfSampleResults );
};

export let gfxDrawGame = ( prevState: GameState, curState: GameState, lerpTime: number ) =>
{
    let t = curState.tick + (curState.tick - prevState.tick) * lerpTime;

    {
        g.useProgram( _mainShader );
        g.bindFramebuffer( gl_FRAMEBUFFER, _framebuffer );
        g.viewport( 0, 0, MAIN_WIDTH, MAIN_HEIGHT );
        g.uniform2f( g.getUniformLocation( _mainShader, 'u_resolution' ), MAIN_WIDTH, MAIN_HEIGHT );
        g.uniform1f( g.getUniformLocation( _mainShader, 'u_time' ), t / 30 );
        g.uniform1i( g.getUniformLocation( _mainShader, 'u_enableSampleMode' ), 0 );
        fullScreenDraw( _mainShader );
    }

    {
        g.useProgram( _postShader );
        g.bindFramebuffer( gl_FRAMEBUFFER, null );
        g.viewport( 0, 0, OUT_WIDTH, OUT_HEIGHT );
        g.activeTexture( gl_TEXTURE0 );
        g.bindTexture( gl_TEXTURE_2D, _framebufferTexture );
        g.uniform2f( g.getUniformLocation( _postShader, 'u_resolution' ), OUT_WIDTH, OUT_HEIGHT );
        g.uniform1f( g.getUniformLocation( _postShader, 'u_time' ), t / 30 );
        g.uniform1i( g.getUniformLocation( _postShader, 'u_tex' ), 0 );
        fullScreenDraw( _postShader );
    }
};
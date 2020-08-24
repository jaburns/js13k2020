import { main_vert, main_frag, post_frag } from "./shaders.gen";
import { DEBUG } from "./debug.gen";
import { gl_VERTEX_SHADER, gl_FRAGMENT_SHADER, gl_ARRAY_BUFFER, gl_STATIC_DRAW, gl_FRAMEBUFFER, gl_TEXTURE_2D, gl_RGBA, gl_UNSIGNED_BYTE, gl_LINEAR, gl_CLAMP_TO_EDGE, gl_TEXTURE_WRAP_S, gl_TEXTURE_WRAP_T, gl_TEXTURE_MIN_FILTER, gl_COLOR_ATTACHMENT0, gl_NEAREST, gl_FLOAT, gl_TRIANGLES, gl_BYTE, gl_TEXTURE0, gl_TEXTURE_MAG_FILTER, gl_TEXTURE1 } from "./glConsts";

declare const a: HTMLCanvasElement;
declare const g: WebGLRenderingContext;
declare const s_totalStateSize: number;
declare const s_wheelBaseWidth: number;
declare const s_wheelBaseLength: number;

/*
  State map:

    Wheel:  size(3)
        xyz pos;
        xyz lastPos;
        xyz forceCache;

    State:  size(2 + 4*size(Wheel) = 14)
        x tick (do we even care about the tick?)
        xyzw  Inputs(up/down/left/right)
        Wheel wheels[4]
*/

const enum Actions
{
    Up = 38, // key: up
    Down = 40, // key: down
    Left = 37, // key: left
    Right = 39, // key: right
};
// 
// let inputsHeld: {[k: number]: true} = {};
// 
// document.onkeydown = k => inputsHeld[k.keyCode] = true;
// document.onkeyup = k => delete inputsHeld[k.keyCode];

const INITIAL_STATE = Float32Array.of(
    0, 0, 0, 0,
    
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,

    s_wheelBaseWidth, 0, 0, 0,
    s_wheelBaseWidth, 0, 0, 0,
    0, 0, 0, 0,

    s_wheelBaseWidth, 0, s_wheelBaseLength, 0,
    s_wheelBaseWidth, 0, s_wheelBaseLength, 0,
    0, 0, 0, 0,

    0, 0, s_wheelBaseLength, 0,
    0, 0, s_wheelBaseLength, 0,
    0, 0, 0, 0,
);

const TICK_LENGTH_MILLIS = 33.3;
const MAIN_WIDTH = 512, MAIN_HEIGHT = 384;
//const MAIN_WIDTH = 320, MAIN_HEIGHT = 240;
const OUT_WIDTH = 1024, OUT_HEIGHT = 768;
const STATE_WIDTH = s_totalStateSize, STATE_HEIGHT = 1;

type Framebuffer = [WebGLFramebuffer,WebGLTexture];

let _previousTime = performance.now();
let _tickAccTime = 0;

let _fullScreenQuadVertBuffer: WebGLBuffer;

let _mainShader: WebGLProgram;
let _stateShader: WebGLProgram;
let _postShader: WebGLProgram;

let _drawFramebuffer: Framebuffer;
let _stateFramebuffers: Framebuffer[];
let _curStateBufferIndex: number = 0;

let buildShader = ( vert: string, frag: string, main?: string ): WebGLProgram =>
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
    g.shaderSource( fs, 'precision highp float;'+frag.replace(main||'m0','main') );
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
    g.getExtension('OES_texture_float_linear');

    _mainShader = buildShader( main_vert, main_frag );
    _stateShader = buildShader( main_vert, main_frag, 'm1' );
    _postShader = buildShader( main_vert, post_frag );

    _fullScreenQuadVertBuffer = g.createBuffer()!;
    g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenQuadVertBuffer );
    g.bufferData( gl_ARRAY_BUFFER, Uint8Array.of(1, 1, 1, 128, 128, 1), gl_STATIC_DRAW );

    let fb: WebGLFramebuffer, tex: WebGLTexture;

    fb = g.createFramebuffer()!;
    tex = g.createTexture()!;

    g.bindFramebuffer( gl_FRAMEBUFFER, fb );
    g.bindTexture( gl_TEXTURE_2D, tex );
    g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, MAIN_WIDTH, MAIN_HEIGHT, 0, gl_RGBA, gl_UNSIGNED_BYTE, null );

    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
    g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, tex, 0 );

    _drawFramebuffer = [fb, tex];

    _stateFramebuffers = [0, 1].map(i => (
        fb = g.createFramebuffer()!,
        tex = g.createTexture()!,

        g.bindFramebuffer( gl_FRAMEBUFFER, fb ),
        g.bindTexture( gl_TEXTURE_2D, tex ),
        g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, STATE_WIDTH, STATE_HEIGHT, 0, gl_RGBA, gl_FLOAT, INITIAL_STATE ),

        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_NEAREST ),
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE ),
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE ),
        g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, tex, 0 ),

        [fb, tex]
    ))
}

let fullScreenDraw = ( shader: WebGLProgram ) =>
{
    g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenQuadVertBuffer );
    let posLoc = g.getAttribLocation( shader, 'a_position' );
    g.enableVertexAttribArray( posLoc );
    g.vertexAttribPointer( posLoc, 2, gl_BYTE, false, 0, 0 );
    g.drawArrays( gl_TRIANGLES, 0, 3 );
};

let gfxStepState = () =>
{
    g.useProgram( _stateShader );
    g.bindFramebuffer( gl_FRAMEBUFFER, _stateFramebuffers[1-_curStateBufferIndex][0] );
    g.viewport( 0, 0, STATE_WIDTH, STATE_HEIGHT );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );

    _curStateBufferIndex = 1 - _curStateBufferIndex;

    g.uniform1i( g.getUniformLocation( _stateShader, 'u_modeState' ), 1 );
    g.uniform1i( g.getUniformLocation( _stateShader, 'u_state' ), 0 );

    fullScreenDraw( _stateShader );
};

let gfxDrawGame = ( lerpTime: number ) =>
{
    {
        g.useProgram( _mainShader );
        g.bindFramebuffer( gl_FRAMEBUFFER, _drawFramebuffer[0] );
        g.viewport( 0, 0, MAIN_WIDTH, MAIN_HEIGHT );

        g.activeTexture( gl_TEXTURE0 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );
        g.activeTexture( gl_TEXTURE1 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[1-_curStateBufferIndex][1] );

        g.uniform1i( g.getUniformLocation( _mainShader, 'u_modeState' ), 0 );
        g.uniform1i( g.getUniformLocation( _mainShader, 'u_state' ), 0 );
        g.uniform1i( g.getUniformLocation( _mainShader, 'u_prevState' ), 1 );
        g.uniform1f( g.getUniformLocation( _mainShader, 'u_lerpTime' ), lerpTime );
        g.uniform2f( g.getUniformLocation( _mainShader, 'u_resolution' ), MAIN_WIDTH, MAIN_HEIGHT );

        fullScreenDraw( _mainShader );
    }

    {
        g.useProgram( _postShader );
        g.bindFramebuffer( gl_FRAMEBUFFER, null );
        g.viewport( 0, 0, OUT_WIDTH, OUT_HEIGHT );

        g.activeTexture( gl_TEXTURE0 );
        g.bindTexture( gl_TEXTURE_2D, _drawFramebuffer[1] );

        g.uniform2f( g.getUniformLocation( _postShader, 'u_resolution' ), OUT_WIDTH, OUT_HEIGHT );
        g.uniform1f( g.getUniformLocation( _postShader, 'u_time' ), 0 );  // TODO supply time
        g.uniform1i( g.getUniformLocation( _postShader, 'u_tex' ), 0 );

        fullScreenDraw( _postShader );
    }
};

let frame = () =>
{
    requestAnimationFrame( frame );

    let newTime = performance.now();
    let deltaTime = newTime - _previousTime;
    _previousTime = newTime;

    _tickAccTime += deltaTime;
    while( _tickAccTime >= TICK_LENGTH_MILLIS )
    {
        _tickAccTime -= TICK_LENGTH_MILLIS;
        gfxStepState();
    }

    gfxDrawGame( _tickAccTime / TICK_LENGTH_MILLIS );
};

frame();
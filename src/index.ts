import { main_vert, main_frag, post_frag } from "./shaders.gen";
import { DEBUG } from "./debug.gen";
import { gl_VERTEX_SHADER, gl_FRAGMENT_SHADER, gl_ARRAY_BUFFER, gl_STATIC_DRAW, gl_FRAMEBUFFER, gl_TEXTURE_2D, gl_RGBA, gl_UNSIGNED_BYTE, gl_LINEAR, gl_CLAMP_TO_EDGE, gl_TEXTURE_WRAP_S, gl_TEXTURE_WRAP_T, gl_TEXTURE_MIN_FILTER, gl_COLOR_ATTACHMENT0, gl_NEAREST, gl_FLOAT, gl_TRIANGLES, gl_BYTE, gl_TEXTURE0, gl_TEXTURE_MAG_FILTER, gl_TEXTURE1, gl_RGB } from "./glConsts";

declare const a: HTMLCanvasElement;
declare const g: WebGLRenderingContext;
declare const s_totalStateSize: number;
declare const s_wheelBaseWidth: number;
declare const s_wheelBaseLength: number;

const enum KeyCode
{
    Up = 38, // key: up
    Down = 40, // key: down
    Left = 37, // key: left
    Right = 39, // key: right
};

type Framebuffer = [WebGLFramebuffer,WebGLTexture];

const TICK_LENGTH_MILLIS = 33.3;
const MAIN_WIDTH = 512, MAIN_HEIGHT = 384; //const MAIN_WIDTH = 320, MAIN_HEIGHT = 240;
const OUT_WIDTH = 1024, OUT_HEIGHT = 768;

let _previousTime = performance.now();
let _tickAccTime = 0;
let _inputs: {[k: number]: true} = {};

let _fullScreenQuadVertBuffer: WebGLBuffer;

let _mainShader: WebGLProgram;
let _stateShader: WebGLProgram;
let _postShader: WebGLProgram;

let _drawFramebuffer: Framebuffer;
let _stateFramebuffers: Framebuffer[];
let _curStateBufferIndex: number = 0;

let x_fb: WebGLFramebuffer;
let x_tex: WebGLTexture;

let buildShader = ( vert: string, frag: string, main?: string ): WebGLProgram =>
{
    let vs = g.createShader( gl_VERTEX_SHADER )!;
    let fs = g.createShader( gl_FRAGMENT_SHADER )!;
    let ss = g.createProgram()!;

    g.shaderSource( vs, vert );
    g.compileShader( vs );

    if( DEBUG )
    {
        let log = g.getShaderInfoLog(vs);
        if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
            console.error( 'Vertex shader error', log, vert );
    }

    g.shaderSource( fs, 'precision highp float;'+frag.replace(main||'m0','main') );
    g.compileShader( fs );

    if( DEBUG )
    {
        let log = g.getShaderInfoLog(fs);
        if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
            console.error( 'Fragment shader error', log, fs );
    }

    g.attachShader( ss, vs );
    g.attachShader( ss, fs );
    g.linkProgram( ss );

    return ss;
};

let fullScreenDraw = ( shader: WebGLProgram ) =>
{
    g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenQuadVertBuffer );
    let posLoc = g.getAttribLocation( shader, 'a_position' );
    g.enableVertexAttribArray( posLoc );
    g.vertexAttribPointer( posLoc, 2, gl_BYTE, false, 0, 0 );
    g.drawArrays( gl_TRIANGLES, 0, 3 );
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

        g.useProgram( _stateShader );
        g.bindFramebuffer( gl_FRAMEBUFFER, _stateFramebuffers[1-_curStateBufferIndex][0] );
        g.viewport( 0, 0, s_totalStateSize, 1 );

        g.activeTexture( gl_TEXTURE0 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );

        _curStateBufferIndex = 1 - _curStateBufferIndex;

        g.uniform1i( g.getUniformLocation( _stateShader, 'u_modeState' ), 1 );
        g.uniform1i( g.getUniformLocation( _stateShader, 'u_state' ), 0 );

        fullScreenDraw( _stateShader );
    }

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
    g.uniform1f( g.getUniformLocation( _mainShader, 'u_lerpTime' ), _tickAccTime / TICK_LENGTH_MILLIS );
    g.uniform2f( g.getUniformLocation( _mainShader, 'u_resolution' ), MAIN_WIDTH, MAIN_HEIGHT );

    fullScreenDraw( _mainShader );

    g.useProgram( _postShader );

    g.bindFramebuffer( gl_FRAMEBUFFER, null );
    g.viewport( 0, 0, OUT_WIDTH, OUT_HEIGHT );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _drawFramebuffer[1] );

    g.uniform2f( g.getUniformLocation( _postShader, 'u_resolution' ), OUT_WIDTH, OUT_HEIGHT );
    g.uniform1f( g.getUniformLocation( _postShader, 'u_time' ), 0 );  // TODO supply time
    g.uniform1i( g.getUniformLocation( _postShader, 'u_tex' ), 0 );

    fullScreenDraw( _postShader );
};

document.onkeydown = k => _inputs[k.keyCode] = true;
document.onkeyup = k => delete _inputs[k.keyCode];

g.getExtension('OES_texture_float');
g.getExtension('OES_texture_float_linear');

_mainShader = buildShader( main_vert, main_frag );
_stateShader = buildShader( main_vert, main_frag, 'm1' );
_postShader = buildShader( main_vert, post_frag );

_fullScreenQuadVertBuffer = g.createBuffer()!;
g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenQuadVertBuffer );
g.bufferData( gl_ARRAY_BUFFER, Uint8Array.of(1, 1, 1, 128, 128, 1), gl_STATIC_DRAW );

x_fb = g.createFramebuffer()!;
x_tex = g.createTexture()!;

g.bindFramebuffer( gl_FRAMEBUFFER, x_fb );
g.bindTexture( gl_TEXTURE_2D, x_tex );
g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, MAIN_WIDTH, MAIN_HEIGHT, 0, gl_RGBA, gl_UNSIGNED_BYTE, null );

g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, x_tex, 0 );

_drawFramebuffer = [x_fb, x_tex];

_stateFramebuffers = [0, 1].map(i =>
(
    x_fb = g.createFramebuffer()!,
    x_tex = g.createTexture()!,

    g.bindFramebuffer( gl_FRAMEBUFFER, x_fb ),
    g.bindTexture( gl_TEXTURE_2D, x_tex ),
    g.texImage2D( gl_TEXTURE_2D, 0, gl_RGB, s_totalStateSize, 1, 0, gl_RGB, gl_FLOAT, Float32Array.of(
    // Initial state
        0, 0, 0, 
        0, 0, 0, 
        
        0, 0, 0, 
        0, 0, 0, 
        0, 0, 0, 

        s_wheelBaseWidth, 0, 0, 
        s_wheelBaseWidth, 0, 0, 
        0, 0, 0, 

        s_wheelBaseWidth, 0, s_wheelBaseLength,
        s_wheelBaseWidth, 0, s_wheelBaseLength,
        0, 0, 0,

        0, 0, s_wheelBaseLength,
        0, 0, s_wheelBaseLength,
        0, 0, 0,
    )),

    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_NEAREST ),
    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE ),
    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE ),
    g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, x_tex, 0 ),

    [x_fb, x_tex]
));

frame();
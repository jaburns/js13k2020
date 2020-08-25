import { main_vert, main_frag, post_frag } from "./shaders.gen";
import { DEBUG } from "./debug.gen";
import { gl_VERTEX_SHADER, gl_FRAGMENT_SHADER, gl_ARRAY_BUFFER, gl_STATIC_DRAW, gl_FRAMEBUFFER, gl_TEXTURE_2D, gl_RGBA, gl_UNSIGNED_BYTE, gl_LINEAR, gl_CLAMP_TO_EDGE, gl_TEXTURE_WRAP_S, gl_TEXTURE_WRAP_T, gl_TEXTURE_MIN_FILTER, gl_COLOR_ATTACHMENT0, gl_NEAREST, gl_FLOAT, gl_TRIANGLES, gl_BYTE, gl_TEXTURE0, gl_TEXTURE_MAG_FILTER, gl_TEXTURE1, gl_RGB, gl_TEXTURE2 } from "./glConsts";

// =================================================================================================

declare const a: HTMLCanvasElement;
declare const b: HTMLCanvasElement;
declare const g: WebGLRenderingContext;
declare const c: CanvasRenderingContext2D;
declare const s_totalStateSize: number;
declare const s_wheelBaseWidth: number;
declare const s_wheelBaseLength: number;
declare const s_millisPerTick: number;
declare const s_renderWidth: number;
declare const s_renderHeight: number;
declare const s_fullWidth: number;
declare const s_fullHeight: number;
declare const s_audioBufferSize: number;
declare const s_audioSampleRate: number;

const enum KeyCode
{
    Up = 38,
    Down = 40,
    Left = 37,
    Right = 39,
};

type Framebuffer = [WebGLFramebuffer,WebGLTexture];

// =================================================================================================

let _previousTime = performance.now();
let _tickAccTime = 0;
let _inputs: {[k: number]: 1} = {};

let _fullScreenTriVertBuffer: WebGLBuffer;

let _mainShader: WebGLProgram;
let _stateShader: WebGLProgram;
let _postShader: WebGLProgram;
let _canvasTexture: WebGLTexture;

let _drawFramebuffer: Framebuffer;
let _stateFramebuffers: Framebuffer[];
let _curStateBufferIndex: number = 0;

let _audioT: number = 0;

let x_fb: WebGLFramebuffer;
let x_tex: WebGLTexture;

// =================================================================================================

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

// =================================================================================================

let fullScreenDraw = ( shader: WebGLProgram ) =>
{
    g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenTriVertBuffer );
    let posLoc = g.getAttribLocation( shader, 'a_position' );
    g.enableVertexAttribArray( posLoc );
    g.vertexAttribPointer( posLoc, 2, gl_BYTE, false, 0, 0 );
    g.drawArrays( gl_TRIANGLES, 0, 3 );
};

// =================================================================================================

let frame = () =>
{
    requestAnimationFrame( frame );

    let newTime = performance.now();
    let deltaTime = newTime - _previousTime;
    _previousTime = newTime;

    _tickAccTime += deltaTime;
    while( _tickAccTime >= s_millisPerTick )
    {
        _tickAccTime -= s_millisPerTick;

    // ----- Fixed update tick ------------------------------

        g.useProgram( _stateShader );
        g.bindFramebuffer( gl_FRAMEBUFFER, _stateFramebuffers[1-_curStateBufferIndex][0] );
        g.viewport( 0, 0, s_totalStateSize, 1 );

        g.activeTexture( gl_TEXTURE0 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );

        _curStateBufferIndex = 1 - _curStateBufferIndex;

        g.uniform4f( g.getUniformLocation( _stateShader, 'u_inputs' ), ~~_inputs[KeyCode.Up], ~~_inputs[KeyCode.Down], ~~_inputs[KeyCode.Left], ~~_inputs[KeyCode.Right] );
        g.uniform1i( g.getUniformLocation( _stateShader, 'u_modeState' ), 1 );
        g.uniform1i( g.getUniformLocation( _stateShader, 'u_state' ), 0 );

        fullScreenDraw( _stateShader );
    }

    // ----- Frame update ------------------------------

    g.useProgram( _mainShader );

    g.bindFramebuffer( gl_FRAMEBUFFER, _drawFramebuffer[0] );
    g.viewport( 0, 0, s_renderWidth, s_renderHeight );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );
    g.activeTexture( gl_TEXTURE1 );
    g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[1-_curStateBufferIndex][1] );
    g.activeTexture( gl_TEXTURE2 );
    g.bindTexture( gl_TEXTURE_2D, _canvasTexture );

    g.uniform1i( g.getUniformLocation( _mainShader, 'u_modeState' ), 0 );
    g.uniform1i( g.getUniformLocation( _mainShader, 'u_state' ), 0 );
    g.uniform1i( g.getUniformLocation( _mainShader, 'u_prevState' ), 1 );
    g.uniform1i( g.getUniformLocation( _mainShader, 'u_canvas' ), 2 );
    g.uniform1f( g.getUniformLocation( _mainShader, 'u_lerpTime' ), _tickAccTime / s_millisPerTick );
    g.uniform2f( g.getUniformLocation( _mainShader, 'u_resolution' ), s_renderWidth, s_renderHeight );

    fullScreenDraw( _mainShader );

    g.useProgram( _postShader );

    g.bindFramebuffer( gl_FRAMEBUFFER, null );
    g.viewport( 0, 0, s_fullWidth, s_fullHeight );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _drawFramebuffer[1] );

    g.uniform2f( g.getUniformLocation( _postShader, 'u_resolution' ), s_fullWidth, s_fullHeight );
    g.uniform1f( g.getUniformLocation( _postShader, 'u_time' ), _previousTime/1000 );
    g.uniform1i( g.getUniformLocation( _postShader, 'u_tex' ), 0 );

    fullScreenDraw( _postShader );
};

// =================================================================================================

let taylorSquareWave = ( x: number, harmonics: number ): number =>
{
    let result = 0;
    for( let i = 1; i <= harmonics; i += 2 )
        result += 4 / Math.PI / i * Math.sin( i * x );
    return result;
};

let startAudio = () =>
{
    let ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: s_audioSampleRate }) as AudioContext;
    let node = ctx.createScriptProcessor( s_audioBufferSize, 0, 1 );
    node.connect( ctx.destination );
    node.onaudioprocess = e =>
    {
        let buffer = e.outputBuffer.getChannelData( 0 );

    // ----- Audio buffer fill -------------------------

        for( let i = 0; i < buffer.length; ++i )
            buffer[i] = taylorSquareWave( _audioT += 0.005 + 0.001*Math.sin(_audioT/1000), 10 );

    // -------------------------------------------------
    };

    startAudio = () => {};
};

// =================================================================================================

document.onkeydown = k => ( startAudio(), _inputs[k.keyCode] = 1 );
document.onkeyup = k => delete _inputs[k.keyCode];

// =================================================================================================

g.getExtension('OES_texture_float');
g.getExtension('OES_texture_float_linear');

_mainShader = buildShader( main_vert, main_frag );
_stateShader = buildShader( main_vert, main_frag, 'm1' );
_postShader = buildShader( main_vert, post_frag );

_fullScreenTriVertBuffer = g.createBuffer()!;
g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenTriVertBuffer );
g.bufferData( gl_ARRAY_BUFFER, Uint8Array.of(1, 1, 1, 128, 128, 1), gl_STATIC_DRAW );

x_fb = g.createFramebuffer()!;
x_tex = g.createTexture()!;

g.bindFramebuffer( gl_FRAMEBUFFER, x_fb );
g.bindTexture( gl_TEXTURE_2D, x_tex );
g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, s_renderWidth, s_renderHeight, 0, gl_RGBA, gl_UNSIGNED_BYTE, null );

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

// =================================================================================================
// https://jsfiddle.net/p49wuce2/

c.strokeStyle = '#f00';
c.fillStyle = '#f00';
c.lineWidth = 40;
let Y = -50, X = 210;
c.beginPath();
c.moveTo(Y+180,250);
c.lineTo(Y+180,200);
c.lineTo(Y+120,200);
c.lineTo(Y+200,100);
c.lineTo(Y+200,150);
c.stroke();

c.beginPath();
c.moveTo(Y+250,100);
c.lineTo(Y+250,230);
c.lineTo(Y+310,230);
c.lineTo(Y+310,100);
c.lineTo(Y+250,100);
c.stroke();
c.beginPath();
c.moveTo(Y+X+180,250);
c.lineTo(Y+X+180,200);
c.lineTo(Y+X+120,200);
c.lineTo(Y+X+200,100);
c.lineTo(Y+X+200,150);
c.stroke();

b.style.letterSpacing = '-2px';
c.font = 'bold 64px monospace';
c.fillText('kph',Y+410,250);

b.style.letterSpacing = '0px';
c.fillStyle = '#ff0';
c.font = 'bold 24px monospace';
c.fillText( 'PRESS SPACE', 180, 330 );

_canvasTexture = g.createTexture()!;
g.bindTexture( gl_TEXTURE_2D, _canvasTexture );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, gl_RGBA, gl_UNSIGNED_BYTE, b );

// =================================================================================================

frame();
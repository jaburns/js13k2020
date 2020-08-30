import { main_vert, main_frag, post_frag } from "./shaders.gen";
import { DEBUG } from "./debug.gen";
import { gl_VERTEX_SHADER, gl_FRAGMENT_SHADER, gl_ARRAY_BUFFER, gl_STATIC_DRAW, gl_FRAMEBUFFER, gl_TEXTURE_2D, gl_RGBA, gl_UNSIGNED_BYTE, gl_LINEAR, gl_CLAMP_TO_EDGE, gl_TEXTURE_WRAP_S, gl_TEXTURE_WRAP_T, gl_TEXTURE_MIN_FILTER, gl_COLOR_ATTACHMENT0, gl_NEAREST, gl_FLOAT, gl_TRIANGLES, gl_BYTE, gl_TEXTURE0, gl_TEXTURE_MAG_FILTER, gl_TEXTURE1, gl_RGB, gl_TEXTURE2 } from "./glConsts";
import { startAudio, setSynthMenuMode } from "./synth";

// =================================================================================================

declare const C0: HTMLCanvasElement;
declare const C1: HTMLCanvasElement;
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

const enum KeyCode
{
    Up = 38,
    Down = 40,
    Left = 37,
    Right = 39,
    Space = 32,
};

const enum Mode
{
    Menu = 0,
    Race = 1,
}

type Framebuffer = [WebGLFramebuffer,WebGLTexture];

// =================================================================================================

let _tickAccTime = 0;
let _inputs: {[k: number]: 1} = {};
let _previousTime: number;
let _veryStartTime: number = 0;
let _startTime: number;

let _fullScreenTriVertBuffer: WebGLBuffer;

let _mainShader: WebGLProgram;
let _stateShader: WebGLProgram;
let _post0Shader: WebGLProgram;
let _post1Shader: WebGLProgram;
let _canvasTexture: WebGLTexture;

let _draw0Framebuffer: Framebuffer;
let _draw1Framebuffer: Framebuffer;
let _stateFramebuffers: Framebuffer[];
let _curStateBufferIndex: number = 0;

let _mode: Mode = Mode.Menu;

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

let resetState = () =>
{
    let z = _mode == Mode.Menu ? -.65 : 0;

    _startTime = _previousTime;

    _stateFramebuffers.map(([fb, tex]) =>
    {
        g.bindFramebuffer( gl_FRAMEBUFFER, fb );
        g.bindTexture( gl_TEXTURE_2D, tex );
        g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, s_totalStateSize, 1, 0, gl_RGBA, gl_FLOAT, Float32Array.of(
        // Initial state
            0, 0, 0, 0,

            0, 1, 0, 0,
            0, 1, z, 0,
            0, 0, 0, 0,

            s_wheelBaseWidth, 1, 0, 0,
            s_wheelBaseWidth, 1, z,0,
            0, 0, 0, 0,

            s_wheelBaseWidth, 1, s_wheelBaseLength,0,
            s_wheelBaseWidth, 1, s_wheelBaseLength+z,0,
            0, 0, 0,0,

            0, 1, s_wheelBaseLength,0,
            0, 1, s_wheelBaseLength+z,0,
            0, 0, 0, 0,
        ));

        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_NEAREST );
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
        g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, tex, 0 );
    });
};

// =================================================================================================

let updateCanvasTexture = () =>
{
    g.bindTexture( gl_TEXTURE_2D, _canvasTexture );
    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
    g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
    g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, gl_RGBA, gl_UNSIGNED_BYTE, C1 );
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

    let newTime = performance.now()/1000;
    let deltaTime = newTime - _previousTime;
    _previousTime = newTime;

    if( _startTime )
    {
        _tickAccTime += deltaTime*1000;

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
            g.uniform1i( g.getUniformLocation( _stateShader, 'u_modeTitle' ), ~~(_mode == Mode.Menu) );
            g.uniform1i( g.getUniformLocation( _stateShader, 'u_state' ), 0 );

            fullScreenDraw( _stateShader );
        }

        // ----- Frame update ------------------------------

        if( _mode == Mode.Menu )
        {
            if( newTime > _startTime + 8 ) resetState();
            if( _inputs[ KeyCode.Space ]) {
                _mode = Mode.Race;
                c.clearRect(0, 0, s_renderWidth, s_renderHeight);
                updateCanvasTexture();
                setSynthMenuMode(0);
                resetState();
            }
        }

        g.useProgram( _mainShader );

        g.bindFramebuffer( gl_FRAMEBUFFER, _draw0Framebuffer[0] );
        g.viewport( 0, 0, s_renderWidth, s_renderHeight );

        g.activeTexture( gl_TEXTURE0 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );
        g.activeTexture( gl_TEXTURE1 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[1-_curStateBufferIndex][1] );

        g.uniform1i( g.getUniformLocation( _mainShader, 'u_modeState' ), 0 );
        g.uniform1i( g.getUniformLocation( _mainShader, 'u_modeTitle' ), ~~(_mode == Mode.Menu) );
        g.uniform1f( g.getUniformLocation( _mainShader, 'u_time' ), newTime - _startTime );
        g.uniform1i( g.getUniformLocation( _mainShader, 'u_state' ), 0 );
        g.uniform1i( g.getUniformLocation( _mainShader, 'u_prevState' ), 1 );
        g.uniform1f( g.getUniformLocation( _mainShader, 'u_lerpTime' ), _tickAccTime / s_millisPerTick );
        g.uniform2f( g.getUniformLocation( _mainShader, 'u_resolution' ), s_renderWidth, s_renderHeight );

        fullScreenDraw( _mainShader );
    }

    // ----- Post-processing update ------------------------------

    g.useProgram( _post0Shader );

    g.bindFramebuffer( gl_FRAMEBUFFER, _draw1Framebuffer[0] );
    g.viewport( 0, 0, s_renderWidth, s_renderHeight );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _draw0Framebuffer[1] );
    g.activeTexture( gl_TEXTURE1 );
    g.bindTexture( gl_TEXTURE_2D, _canvasTexture );

    g.uniform2f( g.getUniformLocation( _post0Shader, 'u_time' ), _veryStartTime, newTime );
    g.uniform1i( g.getUniformLocation( _post0Shader, 'u_tex' ), 0 );
    g.uniform1i( g.getUniformLocation( _post0Shader, 'u_canvas' ), 1 );

    fullScreenDraw( _post0Shader );

    g.useProgram( _post1Shader );

    g.bindFramebuffer( gl_FRAMEBUFFER, null );
    g.viewport( 0, 0, s_fullWidth, s_fullHeight );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _draw1Framebuffer[1] );

    g.uniform2f( g.getUniformLocation( _post1Shader, 'u_time' ), _veryStartTime, newTime );
    g.uniform1i( g.getUniformLocation( _post1Shader, 'u_tex' ), 0 );

    fullScreenDraw( _post1Shader );
};

// =================================================================================================

C0.onclick = () => _startTime || ( _veryStartTime = _startTime = _previousTime, startAudio() );
document.onkeydown = k => _inputs[k.keyCode] = 1;
document.onkeyup = k => delete _inputs[k.keyCode];

// =================================================================================================

g.getExtension('OES_texture_float');
g.getExtension('OES_texture_float_linear');
//g.getExtension('WEBGL_color_buffer_float'); // Needed only to suppress warning in firefox.

_mainShader = buildShader( main_vert, main_frag );
_stateShader = buildShader( main_vert, main_frag, 'm1' );
_post0Shader = buildShader( main_vert, post_frag, 'm0' );
_post1Shader = buildShader( main_vert, post_frag, 'm1' );

_fullScreenTriVertBuffer = g.createBuffer()!;
g.bindBuffer( gl_ARRAY_BUFFER, _fullScreenTriVertBuffer );
g.bufferData( gl_ARRAY_BUFFER, Uint8Array.of(1, 1, 1, 128, 128, 1), gl_STATIC_DRAW );

_draw0Framebuffer = [g.createFramebuffer()!,g.createTexture()!];
_draw1Framebuffer = [g.createFramebuffer()!,g.createTexture()!];

g.bindFramebuffer( gl_FRAMEBUFFER, _draw0Framebuffer[0] );
g.bindTexture( gl_TEXTURE_2D, _draw0Framebuffer[1] );
g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, s_renderWidth, s_renderHeight, 0, gl_RGBA, gl_FLOAT, null );

g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, _draw0Framebuffer[1], 0 );

g.bindFramebuffer( gl_FRAMEBUFFER, _draw1Framebuffer[0] );
g.bindTexture( gl_TEXTURE_2D, _draw1Framebuffer[1] );
g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, s_renderWidth, s_renderHeight, 0, gl_RGBA, gl_UNSIGNED_BYTE, null );

g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, _draw1Framebuffer[1], 0 );

_stateFramebuffers = [[g.createFramebuffer()!,g.createTexture()!],[g.createFramebuffer()!,g.createTexture()!]];

resetState();
_startTime = 0;

// =================================================================================================

let Y = -50, X = 205;

[[40,'#f00'],[20,'#700']].map(([lw, ss]: [number, string]) =>
{
    c.strokeStyle = ss;
    c.lineWidth = lw;
    c.beginPath();
    c.moveTo(Y+185,250);
    c.lineTo(Y+185,200);
    c.lineTo(Y+125,200);
    c.lineTo(Y+205,100);
    c.lineTo(Y+205,150);
    c.stroke();
    c.beginPath();
    c.moveTo(Y+250,100);
    c.lineTo(Y+250,230);
    c.lineTo(Y+310,230);
    c.lineTo(Y+310,100);
    c.lineTo(Y+250,100);
    c.lineTo(Y+250,230);
    c.stroke();
    c.beginPath();
    c.moveTo(Y+X+185,250);
    c.lineTo(Y+X+185,200);
    c.lineTo(Y+X+125,200);
    c.lineTo(Y+X+205,100);
    c.lineTo(Y+X+205,150);
    c.stroke();
});

c.fillStyle = '#f00';
C1.style.letterSpacing = '-2px';
c.font = 'bold 64px monospace';
c.fillText('kph',Y+410,250);

C1.style.letterSpacing = '0px';
c.fillStyle = '#0ff';
c.font = 'bold 24px monospace';
c.fillText( 'PRESS SPACE', 180, 330 );

c.font = 'bold 16px monospace';
c.fillText( 'USE ARROW KEYS TO DRIVE', 145, 360 );

_canvasTexture = g.createTexture()!;
updateCanvasTexture();

// =================================================================================================

frame();
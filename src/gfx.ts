import { main_vert, main_frag, post_frag } from "./shaders.gen";
import { DEBUG } from "./debug.gen";
import { gl_VERTEX_SHADER, gl_FRAGMENT_SHADER, gl_ARRAY_BUFFER, gl_STATIC_DRAW, gl_FRAMEBUFFER, gl_TEXTURE_2D, gl_RGBA, gl_UNSIGNED_BYTE, gl_LINEAR, gl_CLAMP_TO_EDGE, gl_TEXTURE_WRAP_S, gl_TEXTURE_WRAP_T, gl_TEXTURE_MIN_FILTER, gl_COLOR_ATTACHMENT0, gl_NEAREST, gl_FLOAT, gl_TRIANGLES, gl_BYTE, gl_TEXTURE0, gl_TEXTURE_MAG_FILTER } from "./glConsts";
import { InputState } from "./input";

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

const INITIAL_STATE = Float32Array.of(
    0, 0, 0, 0,
    0, 0, 0, 0,
    
    0,   0,   0, 0, 0,   0, 0,   0, 0, 0, 0, 0,
    1.3, 0,   0, 0, 1.3, 0, 0,   0, 0, 0, 0, 0,
    1.3, 0, 1.8, 0, 1.3, 0, 1.8, 0, 0, 0, 0, 0,
    0,   0, 1.8, 0, 0,   0, 1.8, 0, 0, 0, 0, 0,
);

const MAIN_WIDTH = 512; const MAIN_HEIGHT = 384;
//const MAIN_WIDTH = 320; const MAIN_HEIGHT = 240;
const OUT_WIDTH = 1024;
const OUT_HEIGHT = 768;
const SDF_SAMPLE_WIDTH = 14;
const SDF_SAMPLE_HEIGHT = 1;

declare const a: HTMLCanvasElement;
declare const g: WebGLRenderingContext;

type Framebuffer = [WebGLFramebuffer,WebGLTexture];

let _fullScreenQuadVertBuffer: WebGLBuffer;

let _mainShader: WebGLProgram;
let _postShader: WebGLProgram;

let _drawFramebuffer: Framebuffer;
let _stateFramebuffers: Framebuffer[];
let _curStateBufferIndex: number = 0;

export let sdfSampleResults = new Float32Array( 4 * SDF_SAMPLE_WIDTH * SDF_SAMPLE_HEIGHT );

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
    g.getExtension('OES_texture_float_linear');

    _mainShader = buildShader( main_vert, main_frag );
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
        g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, SDF_SAMPLE_WIDTH, SDF_SAMPLE_HEIGHT, 0, gl_RGBA, gl_FLOAT, INITIAL_STATE ),

        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR ),
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MAG_FILTER, gl_LINEAR ),
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

export let gfxStepState = ( inputs: InputState ) =>
{
    g.useProgram( _mainShader );
    g.bindFramebuffer( gl_FRAMEBUFFER, _stateFramebuffers[1-_curStateBufferIndex][0] );
    g.viewport( 0, 0, SDF_SAMPLE_WIDTH, SDF_SAMPLE_HEIGHT );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );

    g.uniform1i( g.getUniformLocation( _mainShader, 'u_stateMode' ), 1 );
    g.uniform1i( g.getUniformLocation( _mainShader, 'u_state' ), 0 );

    fullScreenDraw( _mainShader );
};

export let gfxDrawGame = ( lerpTime: number ) =>
{
    {
        g.useProgram( _mainShader );
        g.bindFramebuffer( gl_FRAMEBUFFER, _drawFramebuffer[0] );
        g.viewport( 0, 0, MAIN_WIDTH, MAIN_HEIGHT );

        g.activeTexture( gl_TEXTURE0 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );

        g.uniform1i( g.getUniformLocation( _mainShader, 'u_stateMode' ), 0 );
        g.uniform1i( g.getUniformLocation( _mainShader, 'u_state' ), 0 );
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

/*
let _startWheelPos: Vec3[] = [[0,0,0],[1.3,0,0],[1.3,0,1.8],[0,0,1.8]];
let _distances = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map(([i,j]) => [i,j,Math.hypot(...vec3_minus(_startWheelPos[i], _startWheelPos[j]))]);

export let stateNew = (): GameState =>
({
    tick: 0,
    cameraPos: [-5,0,-10],
    cameraLook: [0,0,1],
    wheels: _startWheelPos.map( (x:Vec3) => ({ pos: x, lastPos: x, forceCache: [0,0,0] }))
});

export let stateStep = ( previous: GameState, inputs: InputState ): GameState =>
{
    let state = JSON.parse(JSON.stringify( previous )) as GameState;

    state.tick++;

    for( let i = 0; i < 4; ++i )
    {
        let posStep = vec3_plus(
            vec3_minus( state.wheels[i].pos, state.wheels[i].lastPos ),
            [ 0, -.0109, 0],
        );
        state.wheels[i].lastPos = state.wheels[i].pos;

        state.wheels[i].pos = vec3_plus( state.wheels[i].pos, posStep );

        gfxSampleSDF( state.wheels );
        let normal: Vec3 = [sdfSampleResults[4*i], sdfSampleResults[4*i+1], sdfSampleResults[4*i+2]];
        let dist = sdfSampleResults[4*i+3];

        if( dist < 0.5 )
        {
            state.wheels[i].pos = vec3_plus( state.wheels[i].pos, vec3_scale( normal, 0.5 - dist ));

            let vel = vec3_minus( state.wheels[i].pos, state.wheels[i].lastPos );
            vel = vec3_reflect( vel, normal, 2 );
            state.wheels[i].lastPos = vec3_minus( state.wheels[i].pos, vel );
        }
    }

    for( let i = 0; i < 2; ++i )
    {
        _distances.forEach(([i,j,dist]) =>
        {
            let iToJ = vec3_minus( state.wheels[j].pos, state.wheels[i].pos );
            let fixVec = vec3_scale( vec3_normalize( iToJ ), .5 * ( dist - Math.hypot( ...iToJ )))
            state.wheels[i].pos = vec3_minus( state.wheels[i].pos, fixVec );
            state.wheels[j].pos = vec3_plus( state.wheels[j].pos, fixVec );
        });
    }

    // TODO update body and camera position/rotation

    return state;
};
*/
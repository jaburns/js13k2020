import { main_vert, main_frag, post_frag } from "./shaders.gen";
import { DEBUG } from "./debug.gen";
import { gl_VERTEX_SHADER, gl_FRAGMENT_SHADER, gl_ARRAY_BUFFER, gl_STATIC_DRAW, gl_FRAMEBUFFER, gl_TEXTURE_2D, gl_RGBA, gl_UNSIGNED_BYTE, gl_LINEAR, gl_CLAMP_TO_EDGE, gl_TEXTURE_WRAP_S, gl_TEXTURE_WRAP_T, gl_TEXTURE_MIN_FILTER, gl_COLOR_ATTACHMENT0, gl_NEAREST, gl_FLOAT, gl_TRIANGLES, gl_BYTE, gl_TEXTURE0, gl_TEXTURE_MAG_FILTER, gl_TEXTURE1, gl_RGB, gl_TEXTURE2, gl_TEXTURE3 } from "./glConsts";
import { startAudio, setSynthMenuMode, setEngineSoundFromCarSpeed, playResetSound, playClickSound, playWinSound, playBonkSound } from "./synth";

declare const C0: HTMLCanvasElement;
declare const C1: HTMLCanvasElement;
declare const g: WebGLRenderingContext;
declare const c: CanvasRenderingContext2D;
declare const s_totalStateSize: number;
declare const s_wheelBaseWidth: number;
declare const s_wheelBaseLength: number;
declare const s_millisPerTick: number;
declare const s_ticksPerSecond: number;
declare const s_renderWidth: number;
declare const s_renderHeight: number;
declare const s_fullWidth: number;
declare const s_fullHeight: number;
declare const s_tempo: number;

const enum KeyCode
{
    Up = 38,
    Down = 40,
    Left = 37,
    Right = 39,
    Space = 32,
    Enter = 13,
    Esc = 27,
    R = 82,
    G = 71,
}

const enum StateVal
{
    SteeringAngle = 0,
    Speed = 1,
    Checkpoint0 = 4,
    Checkpoint1 = 5,
    Checkpoint2 = 6,
    Checkpoint3 = 8,
    WheelPos0 = 12,
    WheelRot0 = 24,
    WheelPos1 = 28,
    WheelRot1 = 40,
    WheelPos2 = 44,
    WheelRot2 = 56,
    WheelPos3 = 60,
    WheelRot3 = 72,
    WheelGrounded0 = 26,
    WheelGrounded1 = 42,
    WheelGrounded2 = 58,
    WheelGrounded3 = 74,
}

const enum MenuMode
{
    NoMenu = 0,
    PostRace = 1,
    SelectTrack = 2,
}

type Framebuffer = [WebGLFramebuffer,WebGLTexture];
type SaveDataElem = [number, string]; // [ best time in ticks, ghost string ]
type SaveData = SaveDataElem[];

// =================================================================================================

let _tickAccTime = 0;
let _inputs: {[k: number]: 1} = {};
let _previousTime: number;
let _veryStartTime: number = 0;
let _startTime: number;
let _raceTicks: number;
let _progress: number = 0;

let _fullScreenTriVertBuffer: WebGLBuffer;

let _shaderPairs: [WebGLProgram,WebGLProgram][] = [];
let _trackIndex: number = 1;
let _canvasTexture: WebGLTexture;

let _draw0Framebuffer: Framebuffer;
let _draw1Framebuffer: Framebuffer;
let _stateFramebuffers: Framebuffer[];
let _curStateBufferIndex: number = 0;
let _latestState: Float32Array;

let _loadedSave: SaveData;
let _recordGhost: number[];
let _loadedGhost: Float32Array;
let _loadedGhostPtr: number = -1;
let _ghostTextures: [WebGLTexture,WebGLTexture];
let _ghostTextureIndex: number = 0;
let _exportGhost: string;
let _foreignGhost: 0|1;
let _replayMode: 0|1|2;

let _bootMode: 0|1 = 1;
let _menuMode: MenuMode = 0;
let _menuCursor: number = 0;
let _menu2Cursor: number = 0;

// =================================================================================================

let loadLocalStorage = () =>
{
    let savedStr = localStorage['404kph'];
    _loadedSave = savedStr
        ? JSON.parse( savedStr )
        : [[0],[0],[0],[0],[0],[0],[0],[0]] as any;
};

let fillGhostTexture = () =>
{
    g.bindTexture( gl_TEXTURE_2D, _ghostTextures[ _ghostTextureIndex ]);
    let sliced = _loadedGhost.slice( _loadedGhostPtr, _loadedGhostPtr+16 );
    g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, 4, 1, 0, gl_RGBA, gl_FLOAT, sliced );
};

let loadGhost64 = ( b64?: string ) =>
{
    if( !b64 )
    {
        _loadedGhostPtr = -1;
        return;
    }

    let floats = new Float32Array(Uint8Array.from(atob( b64 ).split('').map(x => x.charCodeAt(0))).buffer);
    _loadedGhost = new Float32Array( 2*floats.length - 32 );
    for( let i = 0; i < _loadedGhost.length/2; i += 16 )
        for( let k = 0; k < 16; ++k )
            _loadedGhost[2*i+k] = floats[i+k],
            _loadedGhost[16+2*i+k] = .5*(floats[i+k] + floats[16+i+k]);

    _loadedGhostPtr = 0;
    fillGhostTexture();
    _ghostTextureIndex = 1 - _ghostTextureIndex;
    fillGhostTexture();
}

// =================================================================================================

let resetState = () =>
{
    let z = -_bootMode * 1.2;

    _raceTicks = 0;
    _startTime = _previousTime;
    _recordGhost = [];
    
    if( _loadedGhostPtr > 0 )
    {
        _loadedGhostPtr = 0;
        fillGhostTexture();
        _ghostTextureIndex = 1 - _ghostTextureIndex;
        fillGhostTexture();
    }

    _stateFramebuffers.map(([fb, tex]) =>
    {
        g.bindFramebuffer( gl_FRAMEBUFFER, fb );
        g.bindTexture( gl_TEXTURE_2D, tex );
        g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, s_totalStateSize, 1, 0, gl_RGBA, gl_FLOAT, Float32Array.of(
        // Initial state
            0, 0, 1, 0, // 0
            0, 0, 0, 0, // 4
            0, 0, 0, 0, // 8

            0, 1, 0, 0, // 12
            0, 1, z, 0, // 16
            0, 0, 0, 0, // 20
            0, 0, 0, 0, // 24

            s_wheelBaseWidth, 1, 0, 0, // 28
            s_wheelBaseWidth, 1, z, 0, // 32
            0, 0, 0, 0, // 36
            0, 0, 0, 0, // 40

            s_wheelBaseWidth, 1, s_wheelBaseLength,   0, // 44
            s_wheelBaseWidth, 1, s_wheelBaseLength+z, 0, // 48
            0, 0, 0, 0, // 52
            0, 0, 0, 0, // 56

            0, 1, s_wheelBaseLength,   0, // 60
            0, 1, s_wheelBaseLength+z, 0, // 64
            0, 0, 0, 0, // 68
            0, 0, 0, 0, // 72
        ));

        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_NEAREST );
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
        g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
        g.framebufferTexture2D( gl_FRAMEBUFFER, gl_COLOR_ATTACHMENT0, gl_TEXTURE_2D, tex, 0 );
    });
};

// =================================================================================================

let ticksToTime = ( ticks: number ) =>
{
    let t = ticks / s_ticksPerSecond;
    let tSec = t % 60 | 0;
    let tCent = t * 100 % 100 |0;
    return ( t / 60 | 0 ) + ':' +
        ( tSec > 9 ? '' : '0' ) + tSec + ':' +
        ( tCent > 9 ? '' : '0' ) + tCent;
};

let drawText = ( str: string, x: number, y: number, size: number, innerColor: string, outerColor: string, border?: number ) =>
{
    c.lineWidth = border || 1;
    c.fillStyle = innerColor;
    c.font = 'bold '+size+'px monospace';
    c.fillText( str, x, y );
    if( border !== 0 )
        c.strokeStyle = outerColor,
        c.strokeText( str, x, y );
};

let drawHUD = () =>
{
    let timeText = ticksToTime( _raceTicks );

    c.clearRect(0, 0, s_renderWidth, s_renderHeight);

    if( _bootMode && _menuMode == MenuMode.NoMenu )
    {
        let Y = -50, X = 205, Z = -5;

        [[40,'#b00'],[20,'#500']].map(([lw, ss]: [number, string]) =>
        {
            c.strokeStyle = ss;
            c.lineWidth = lw;
            c.beginPath();
            c.moveTo(Y+185,Z+250);
            c.lineTo(Y+185,Z+200);
            c.lineTo(Y+125,Z+200);
            c.lineTo(Y+205,Z+100);
            c.lineTo(Y+205,Z+150);
            c.stroke();
            c.beginPath();
            c.moveTo(Y+250,Z+100);
            c.lineTo(Y+250,Z+230);
            c.lineTo(Y+310,Z+230);
            c.lineTo(Y+310,Z+100);
            c.lineTo(Y+250,Z+100);
            c.lineTo(Y+250,Z+230);
            c.stroke();
            c.beginPath();
            c.moveTo(Y+X+185,Z+250);
            c.lineTo(Y+X+185,Z+200);
            c.lineTo(Y+X+125,Z+200);
            c.lineTo(Y+X+205,Z+100);
            c.lineTo(Y+X+205,Z+150);
            c.stroke();
        });

        c.fillStyle = '#b00';
        C1.style.letterSpacing = '-2px';
        c.font = 'bold 64px monospace';
        c.fillText('kph',Y+410,250);
        C1.style.letterSpacing = '0px'; 

        drawText('ARROWS DRIVE  SPACE DRIFTS', 135, 290, 16, '#bb0', '', 0);
        drawText('R RESTARTS  ESC QUITS', 155, 305, 16, '#bb0', '', 0);
        drawText('G FOLLOWS GHOST', 185, 320, 16, '#bb0', '', 0);

        if(( _previousTime / s_tempo ) % 1 > .25 )
            drawText( 'PRESS ENTER', 178, 350, 24, '#0bb', '#06b' );
    }
    else if( _menuMode == MenuMode.PostRace )
    {
        drawText( 'FINISH!', 135, 100, 56, '#0f0', '#080', 3 );
        drawText( timeText,  175, 140, 36, '#0f6', '#083', 2 );

        drawText( 'RETRY',        218, 140+25*3, 24, _menu2Cursor==0?'#bbb':'#0bb', _menu2Cursor==0?'#666':'#06b' );
        drawText( 'NEXT TRACK',   183, 140+25*4, 24, _menu2Cursor==1?'#bbb':'#0bb', _menu2Cursor==1?'#666':'#06b' );
        drawText( 'SELECT TRACK', 168, 140+25*5, 24, _menu2Cursor==2?'#bbb':'#0bb', _menu2Cursor==2?'#666':'#06b' );
        drawText( 'EXPORT GHOST TO CLIPBOARD', 75, 140+25*6, 24, _menu2Cursor==3?'#bbb':'#0bb', _menu2Cursor==3?'#666':'#06b' );
    }
    else if( _menuMode == MenuMode.SelectTrack )
    {
        drawText( 'SELECT TRACK', 80, 80, 48, '#f00', '#800', 3 );
        for( let i = 0; i < 8; ++i )
            drawText( 'TRACK '+(i+1)+'   '+ticksToTime(_loadedSave[i][0]), 135, 127+25*i, 24, _menuCursor==i?'#bbb':'#0bb', _menuCursor==i?'#666':'#06b' );

        drawText( 'PASTE TO IMPORT GHOST FROM CLIPBOARD', 40, 340, 20, '#b60', '', 0 );
    }
    else
    {
        let t = _previousTime - _startTime - .5;
        let t1 = 15*(1-(t%1))|0;
        let t2 = (t1>>1).toString(16);
        t1 = t1.toString(16) as any;
        if( t > 0 && t < 1 )
            drawText( 'READY', 185, 200, 48, '#'+t1+'00', '#'+t2+'00', 3 );
        if( t > 1 && t < 2 )
            drawText( 'GO!', 205, 200, 64, '#0'+t1+'0', '#0'+t2+'0', 4 );

        if( _replayMode )
            drawText( 'REPLAY', 395, 50, 24, '#0b0', '#060' );

        drawText( timeText, 375, 350, 24, '#0bb', '#06b' );
        drawText( (100*_latestState[StateVal.Speed]|0)+' kph', 35, 350, 24, '#b2d', '#906');
    }

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
    let deltaTime = newTime - _previousTime > 1 ? 1 : newTime - _previousTime;
    let prevState: Float32Array;
    _previousTime = newTime;

    if( _startTime )
    {
        _tickAccTime += deltaTime*1000;

        while( _tickAccTime >= s_millisPerTick )
        {
            _tickAccTime -= s_millisPerTick;

        // ----- Fixed update tick ------------------------------

            g.useProgram( _shaderPairs[_trackIndex][1] );
            g.bindFramebuffer( gl_FRAMEBUFFER, _stateFramebuffers[1-_curStateBufferIndex][0] );
            g.viewport( 0, 0, s_totalStateSize, 1 );

            g.activeTexture( gl_TEXTURE0 );
            g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );

            _curStateBufferIndex = 1 - _curStateBufferIndex;

            if( newTime > _startTime + 1.5 )
                g.uniform4f( g.getUniformLocation( _shaderPairs[_trackIndex][1], 'u_inputs' ),
                    ~~_inputs[KeyCode.Up], _inputs[KeyCode.Space] ? -1 : _inputs[KeyCode.Down] ? 1 : 0, ~~_inputs[KeyCode.Left], ~~_inputs[KeyCode.Right]
                );
            else 
                g.uniform4f( g.getUniformLocation( _shaderPairs[_trackIndex][1], 'u_inputs' ), 0, 0, 0, 0 );

            g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][1], 'u_modeState' ), 1 );
            g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][1], 'u_menuMode' ), _bootMode ? 2 : _menuMode == MenuMode.NoMenu ? 0 : 1 );
            g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][1], 'u_state' ), 0 );
            g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][1], 'u_replayMode' ), _replayMode );

            fullScreenDraw( _shaderPairs[_trackIndex][1] );

            prevState = _latestState;
            _latestState = new Float32Array( 4 * s_totalStateSize );
            prevState = prevState || _latestState;
            g.readPixels( 0, 0, s_totalStateSize, 1, gl_RGBA, gl_FLOAT, _latestState );
            setEngineSoundFromCarSpeed( _latestState[StateVal.Speed] );
            drawHUD();

            if( newTime > _startTime + 1.5 )
            {
                if( _loadedGhostPtr >= 0 )
                {
                    _ghostTextureIndex = 1 - _ghostTextureIndex;
                    fillGhostTexture();
                    if( _loadedGhostPtr < _loadedGhost.length - 16 )
                        _loadedGhostPtr += 16;
                    else if( _replayMode == 1 )
                    {
                        _replayMode = 2;
                        _raceTicks += 4;
                    }
                }

                if( _menuMode == MenuMode.NoMenu )
                {
                    if( _replayMode != 2 )
                    if( ++_raceTicks % 2 && !_replayMode )
                        _recordGhost.push(
                            _latestState[StateVal.WheelPos0], _latestState[StateVal.WheelPos0+1], _latestState[StateVal.WheelPos0+2], _latestState[StateVal.SteeringAngle],
                            _latestState[StateVal.WheelPos1], _latestState[StateVal.WheelPos1+1], _latestState[StateVal.WheelPos1+2], _latestState[StateVal.WheelRot1],
                            _latestState[StateVal.WheelPos2], _latestState[StateVal.WheelPos2+1], _latestState[StateVal.WheelPos2+2], _latestState[StateVal.WheelRot2],
                            _latestState[StateVal.WheelPos3], _latestState[StateVal.WheelPos3+1], _latestState[StateVal.WheelPos3+2], _latestState[StateVal.WheelRot3],
                        );

                    if(
                        _latestState[StateVal.Checkpoint0]==2 && prevState[StateVal.Checkpoint0]!=2 ||
                        _latestState[StateVal.Checkpoint1]==2 && prevState[StateVal.Checkpoint1]!=2 ||
                        _latestState[StateVal.Checkpoint2]==2 && prevState[StateVal.Checkpoint2]!=2 ||
                        _latestState[StateVal.Checkpoint3]==2 && prevState[StateVal.Checkpoint3]!=2
                    )
                    {
                        if( _latestState[StateVal.Checkpoint0] + _latestState[StateVal.Checkpoint1] + _latestState[StateVal.Checkpoint2] + _latestState[StateVal.Checkpoint3] > 7 )
                        {
                            _menuMode = MenuMode.PostRace;
                            _menu2Cursor = 1;
                            playWinSound(0);
                            setSynthMenuMode(1);

                            _exportGhost = 
                                btoa([...new Uint8Array(Float32Array.from( _recordGhost ).buffer)].map(x => String.fromCharCode(x)).join(''));

                            if( !_loadedSave[_trackIndex-2][0] || _raceTicks < _loadedSave[_trackIndex-2][0] )
                            {
                                _loadedSave[_trackIndex-2][0] = _raceTicks;
                                _loadedSave[_trackIndex-2][1] = _exportGhost;
                                localStorage['404kph'] = JSON.stringify( _loadedSave );
                                localStorage['OS13kTrophy,🏎️,404kph,Track '+(_trackIndex-1)] = ticksToTime(_raceTicks);

                                if( !_foreignGhost )
                                    loadGhost64( _exportGhost );
                            }
                        }
                        else
                            playWinSound(1);
                    }

                    if( 
                        _latestState[StateVal.WheelGrounded0] && !prevState[StateVal.WheelGrounded0] ||
                        _latestState[StateVal.WheelGrounded1] && !prevState[StateVal.WheelGrounded1] ||
                        _latestState[StateVal.WheelGrounded2] && !prevState[StateVal.WheelGrounded2] ||
                        _latestState[StateVal.WheelGrounded3] && !prevState[StateVal.WheelGrounded3]
                    )
                        playBonkSound();
                }

                if( _bootMode && newTime > _startTime + 8 )
                    resetState();
            }
        }

        // ----- Frame update ------------------------------

        g.useProgram( _shaderPairs[_trackIndex][0] );

        g.bindFramebuffer( gl_FRAMEBUFFER, _draw0Framebuffer[0] );
        g.viewport( 0, 0, s_renderWidth, s_renderHeight );

        g.activeTexture( gl_TEXTURE0 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[_curStateBufferIndex][1] );
        g.activeTexture( gl_TEXTURE1 );
        g.bindTexture( gl_TEXTURE_2D, _stateFramebuffers[1-_curStateBufferIndex][1] );

        g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_modeState' ), 0 );
        g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_menuMode' ), _bootMode ? 2 : _menuMode == MenuMode.NoMenu ? 0 : 1 );
        g.uniform1f( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_time' ), newTime - _startTime );
        g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_state' ), 0 );
        g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_prevState' ), 1 );
        g.uniform1f( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_lerpTime' ), _tickAccTime / s_millisPerTick );

        g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_enableGhost' ), _loadedGhostPtr >= 0 ? 1 : 0 );
        g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_replayMode' ), _replayMode );

        if( _loadedGhostPtr >= 0 )
        {
            g.activeTexture( gl_TEXTURE2 );
            g.bindTexture( gl_TEXTURE_2D, _ghostTextures[_ghostTextureIndex] );
            g.activeTexture( gl_TEXTURE3 );
            g.bindTexture( gl_TEXTURE_2D, _ghostTextures[1-_ghostTextureIndex] );
            g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_ghost' ), 2 );
            g.uniform1i( g.getUniformLocation( _shaderPairs[_trackIndex][0], 'u_prevGhost' ), 3 );
        }

        fullScreenDraw( _shaderPairs[_trackIndex][0] );
    }

    // ----- Post-processing update ------------------------------

    g.useProgram( _shaderPairs[0][0] );

    g.bindFramebuffer( gl_FRAMEBUFFER, _draw1Framebuffer[0] );
    g.viewport( 0, 0, s_renderWidth, s_renderHeight );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _draw0Framebuffer[1] );
    g.activeTexture( gl_TEXTURE1 );
    g.bindTexture( gl_TEXTURE_2D, _canvasTexture );

    g.uniform4f( g.getUniformLocation( _shaderPairs[0][0], 'u_time' ), _veryStartTime, newTime, _startTime, _progress );
    g.uniform1i( g.getUniformLocation( _shaderPairs[0][0], 'u_tex' ), 0 );
    g.uniform1i( g.getUniformLocation( _shaderPairs[0][0], 'u_canvas' ), 1 );
    g.uniform2f( g.getUniformLocation( _shaderPairs[0][0], 'u_skewFade' ), _bootMode && _menuMode == MenuMode.NoMenu ? .3 : 1, _menuMode == MenuMode.NoMenu ? 1 : 0);

    fullScreenDraw( _shaderPairs[0][0] );

    g.useProgram( _shaderPairs[0][1] );

    g.bindFramebuffer( gl_FRAMEBUFFER, null );
    g.viewport( 0, 0, s_fullWidth, s_fullHeight );

    g.activeTexture( gl_TEXTURE0 );
    g.bindTexture( gl_TEXTURE_2D, _draw1Framebuffer[1] );

    g.uniform4f( g.getUniformLocation( _shaderPairs[0][1], 'u_time' ), _veryStartTime, newTime, _startTime, _progress );
    g.uniform1i( g.getUniformLocation( _shaderPairs[0][1], 'u_tex' ), 0 );

    fullScreenDraw( _shaderPairs[0][1] );
};

// =================================================================================================

let loadNewTrack = () =>
{
    _menuMode = MenuMode.NoMenu;
    _bootMode = 0;
    resetState();
    loadGhost64( _trackIndex > 1 ? _loadedSave[_trackIndex-2][1] : 0 as any );
    setSynthMenuMode(0);
    playResetSound();
    playClickSound();
};

C0.onclick = () => 
{
    if( _progress < 1 ) return;

    C0.onclick = 0 as any;

    _veryStartTime = _startTime = _previousTime;

    startAudio();

    document.onpaste = e =>
    {
        if( _menuMode == MenuMode.SelectTrack )
        {
            let str = e.clipboardData!.getData('text').trim();
            _trackIndex = parseInt(str.substr(0,1));
            loadNewTrack();
            loadGhost64( str.substr(1));
        }
    }

    document.onkeyup = k => delete _inputs[k.keyCode];

    document.onkeydown = k =>
    {
        if( k.repeat ) return;
        _inputs[k.keyCode] = 1;

        if( k.keyCode == KeyCode.R && !_bootMode )
        {
            _replayMode = 0;

            _menuMode = MenuMode.NoMenu;
            setSynthMenuMode(0);
            resetState();
            playResetSound();
        }

        if( _menuMode == MenuMode.SelectTrack )
        {
            if( k.keyCode == KeyCode.Down && _menuCursor < 7 )
            {
                _menuCursor++;
                playClickSound();
            }
            if( k.keyCode == KeyCode.Up && _menuCursor > 0 )
            {
                _menuCursor--;
                playClickSound();
            }
            if( k.keyCode == KeyCode.Enter )
            {
                _trackIndex = _menuCursor + 2;
                loadNewTrack();
            }
            if( k.keyCode == KeyCode.Esc )
            {
                _menuMode = MenuMode.NoMenu;
                if( !_bootMode )
                {
                    _bootMode = 1;
                    loadGhost64();
                    resetState();
                    _trackIndex = 1;
                }
                playClickSound();
            }
        }
        else if( !_bootMode )
        {
            if( k.keyCode == KeyCode.Esc )
            {
                _replayMode = 0;

                _menuMode = MenuMode.SelectTrack;
                setSynthMenuMode(1);
                playClickSound();
            }
            if( k.keyCode == KeyCode.G && _loadedGhostPtr >= 0 )
            {
                _replayMode = 1;

                _menuMode = MenuMode.NoMenu;
                setSynthMenuMode(0);
                resetState();
                playResetSound();
            }
            if( _menuMode == MenuMode.PostRace )
            {
                if( k.keyCode == KeyCode.Down && _menu2Cursor < 3 )
                {
                    _menu2Cursor++;
                    playClickSound();
                }
                if( k.keyCode == KeyCode.Up && _menu2Cursor > 0 )
                {
                    _menu2Cursor--;
                    playClickSound();
                }
                if( k.keyCode == KeyCode.Enter )
                {
                    if( _menu2Cursor == 0 )
                    {
                        _menuMode = MenuMode.NoMenu;
                        setSynthMenuMode(0);
                        resetState();
                        playResetSound();
                    }
                    if( _menu2Cursor == 1 )
                    {
                        if( _trackIndex < 9 ) _trackIndex++;
                        loadNewTrack();
                    }
                    if( _menu2Cursor == 2 )
                        _menuMode = MenuMode.SelectTrack;
                    if( _menu2Cursor == 3 )
                        navigator.clipboard.writeText(_trackIndex+_exportGhost).then(playWinSound as any);

                    playClickSound();
                }
            }
        }

        if( _bootMode && _menuMode == MenuMode.NoMenu && k.keyCode == KeyCode.Enter )
        {
            _menuMode = MenuMode.SelectTrack;
            playClickSound();
        }
    };
};

// =================================================================================================

g.getExtension('OES_texture_float');
g.getExtension('OES_texture_float_linear');
//g.getExtension('WEBGL_color_buffer_float'); // Needed only to suppress warning in firefox.

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
_canvasTexture = g.createTexture()!;

_ghostTextures = [g.createTexture()!,g.createTexture()!];
g.bindTexture( gl_TEXTURE_2D, _ghostTextures[0] );
g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, 4, 1, 0, gl_RGBA, gl_FLOAT, null );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );
g.bindTexture( gl_TEXTURE_2D, _ghostTextures[1] );
g.texImage2D( gl_TEXTURE_2D, 0, gl_RGBA, 4, 1, 0, gl_RGBA, gl_FLOAT, null );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_MIN_FILTER, gl_LINEAR );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_S, gl_CLAMP_TO_EDGE );
g.texParameteri( gl_TEXTURE_2D, gl_TEXTURE_WRAP_T, gl_CLAMP_TO_EDGE );

resetState();
_startTime = 0;

// =================================================================================================
{
    let defs: string[], vs: WebGLShader, fs: WebGLShader, ss: WebGLProgram;
    let i: number = 0, step: number = 0;

    let run = () =>
    {
        if( step == 0 )
        {
            vs = g.createShader( gl_VERTEX_SHADER )!;
            fs = g.createShader( gl_FRAGMENT_SHADER )!;
            ss = g.createProgram()!;

            g.shaderSource( vs, main_vert );
            g.compileShader( vs );

            if( DEBUG )
            {
                let log = g.getShaderInfoLog(vs);
                if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
                    console.error( 'Vertex shader error', log, main_vert );
            }
        }
        if( step == 1 )
        {
            defs = i % 2 ? ['XA'] : [];
            if( i > 1 ) defs.push('T0'+((i-2)>>1));

            g.shaderSource( fs, defs.map( x => '#define '+x ).join('\n')+'\nprecision highp float;'+(i < 2 ? post_frag : main_frag) );
            g.compileShader( fs );

            if( DEBUG )
            {
                let log = g.getShaderInfoLog(fs);
                if( log === null || log.length > 0 && log.indexOf('ERROR') >= 0 )
                {
                    console.error( 'Fragment shader error', log, fs );
                    const shader = defs.map( x => '#define '+x ).join('\n')+'\nprecision highp float;'+(i < 2 ? post_frag : main_frag);
                    console.log(shader.split('\n').map( (x,i) => i + ' :: ' + x ).join('\n'));
                }
            }
        }
        if( step == 2 )
        {
            g.attachShader( ss, vs );
            g.attachShader( ss, fs );
            g.linkProgram( ss );
        }
        if( step == 3 )
        {
            g.bindFramebuffer( gl_FRAMEBUFFER, _stateFramebuffers[0][0] );
            g.viewport( 0, 0, 1, 1 );
            g.useProgram( ss );
            fullScreenDraw( ss );

            if( i % 2 )
                _shaderPairs[i/2|0].push(ss);
            else
                _shaderPairs[i/2|0] = [ss] as any;

            step = -1;

            if( i == 1 )
                frame();

            if( ++i > ( DEBUG ? 5 : 17 ))
            {
                C0.style.cursor='pointer';
                _progress = 1;
                return;
            }
        }

        step++;
        _progress = (i + ( step / 4 )) / ( DEBUG ? 6 : 18 );
        setTimeout( run, 30 );
    };

    run();
}

loadLocalStorage();

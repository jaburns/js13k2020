declare const s_audioBufferSize: number;
declare const s_audioSampleRate: number;
declare const s_tempo: number;

let _synthMenuMode: 1|0 = 1;
let _menuModeT = 0;
let _sampleOffset = 0;
let _songPos: number;
let _engineSoundT = 0;
let _engineSpeed = 0;

let AS = 466.16;
let C = 523.25;
let D = 587.33;
let F = 698.46;
let G = 783.99;

let bass0 = [ 349.24, 349.24, 392, 392, 392, 392, 392, 392, 392, 392, 392, 392, 392, 392, 392, 392 ];
let bass1 = [ 329.64, 329.64, 349.24, 349.24, 349.24, 349.24, 349.24, 349.24, 349.24, 349.24, 349.24, 349.24, 554.4, C, AS, 440 ];

let leadnote = [
    0,0,D,F,G,F,G,F, 0,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, 2*AS,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, 0,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, G,F,2*AS,2*C,2*D,0,2*C,2*D,
    2*F,2*G,D,F,G,F,G,F, 0,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, 2*AS,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, 0,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, G,F,2*AS,2*C,2*D,0,2*C,2*D,
    2*F,2*G,D,F,G,F,G,F, 0,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, 2*AS,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, 0,0,0,0,0,0,0,0, 0,0,D,F,G,F,G,F, G,F,2*AS,2*C,2*D,0,2*C,2*D,
    2*F,2*G,D,F,G,F,G,F, 0,0,D,F,G,F,G,F, G,F,2*AS,2*C,2*D,0,2*C,2*D, 2*F,2*G,D,F,G,F,G,F, 0,0,D,F,G,F,G,F, 0,0,D,F,G,F,G,F, 2*G,2*F,2*D,2*F,2*D,2*C,2*AS,2*C, 2*F,2*D,2*C,2*D,2*C,2*AS,G,2*AS,
];

let biquadFilter = ( hpf?: 1|0 ) =>
{
    let x1: number = 0;
    let x2: number = 0;
    let y1: number = 0;
    let y2: number = 0;
    let c0: number = 0;
    let c1: number = 0;
    let c2: number = 0;
    let c3: number = 0;
    let c4: number = 0;

    return ( freq: number, x: Float32Array, y: Float32Array ) =>
    {
        let omega = 2 * Math.PI * freq / s_audioSampleRate;
        let sn = Math.sin(omega);
        let cs = Math.cos(omega);
        let alpha = sn * Math.sinh(Math.log(2) * omega / sn);

        let b0 = (hpf ? 1 + cs : 1 - cs) / 2;
        let b1 = (hpf ? -1 : 1) - cs;
        let b2 = (hpf ? 1+cs : 1-cs) / 2;
        let a0 = 1 + alpha;
        let a1 = -2 * cs;
        let a2 = 1 - alpha;

        c0 = b0 / a0;
        c1 = b1 / a0;
        c2 = b2 / a0;
        c3 = a1 / a0;
        c4 = a2 / a0;

        y[0] = c0*x[0] + c1*x1 + c2*x2 - c3*y1 - c4*y2;
        y[1] = c0*x[1] + c1*x[0] + c2*x1 - c3*y[0] - c4*y1;

        for (let i = 2; i < s_audioBufferSize; ++i)
            y[i] = c0*x[i] + c1*x[i-1] + c2*x[i-2] - c3*y[i-1] - c4*y[i-2];

        x1 = x[s_audioBufferSize - 1];
        x2 = x[s_audioBufferSize - 2];

        y1 = y[s_audioBufferSize - 1];
        y2 = y[s_audioBufferSize - 2];
    };
};

let clamp01 = (x: number) =>
    x < 0 ? 0 : x > 1 ? 1 : x;
let clamp11 = (x: number) =>
    x < -1 ? -1 : x > 1 ? 1 : x;

let smoothstep = (edge0: number, edge1: number, x: number) =>
{
    x = clamp01((x - edge0) / (edge1 - edge0));
    return x * x * (3 - 2 * x);
};

let saw = ( t: number ) =>
    1 - 2 * ((t % (2 * Math.PI)) / (2 * Math.PI));

let tri = ( t: number ) =>
    1 - 2*Math.abs(1 - 2 * ((t % (2 * Math.PI)) / (2 * Math.PI)));

let sqr = ( t: number ) =>
    saw(t) > 0.5 ? 1 : -1;

let sym = ( time: number, tempo: number, a: number, b: number ) =>
    a * (1-2*Math.random()) * Math.exp( -b*(time%tempo) );

let kick = ( time: number, tempo: number ) =>
{
    time %= tempo;
    let attack = clamp01(400*time);
    let decay = 1. - smoothstep( .4, .5, time );
    return .6 * attack * decay * Math.sin( 220. * Math.pow( time, .65 ));
};

let taylorSquareWave = ( x: number, i: number, imax: number ): number =>
{
    let result = 0;
    for( ; i <= imax; i += 2 )
        result += 4 / Math.PI / i * Math.sin( i * x );
    return result;
};

let addCrtBuzz = ( y: Float32Array, noise: Float32Array ) =>
{
    for( let i = 0; i < s_audioBufferSize; ++i )
    {
        let t = (_sampleOffset + i) / s_audioSampleRate - .1;
        if( t < 0 ) {
            y[i] = 0;
        }
        else
        {
            let t1 = 2*Math.PI*60*t;
            let t2 = (t1 % (2*Math.PI)) / (2*Math.PI);
            let t3 = t2 + .01*(1 - (2*t2-1) * (2*t2-1));
            y[i] += .5 * taylorSquareWave( t3, 1, 5 ) * Math.exp( -3 * t );

            if( t < .25 )
                y[i] += 2*noise[i] * Math.exp( -30 * 4*t );
            else if( t < .5 )
                y[i] += 2*noise[i] * Math.exp( -30 * 8*(t-.25) );
        }
    }
};

let genEngineSound = ( y: Float32Array ) =>
{
};

let pad = ( time: number, tempo: number, f?: number ) =>
{
    f = (Math.floor( time / tempo / 16/*note.length*/ ) % 4 === 3 ? bass1 : bass0)[ Math.floor( time / tempo ) % 16 ]
        * (_songPos % 128 >= 64 ? 1.335 : 1); // 1.335 ~ Math.pow(2, 5/12)
    time %= tempo;

    let attack = clamp01(400*time);
    let decay = 1. - smoothstep( .1, .2, time );

    return .5 * .8 * attack * decay * (tri( f * time ) + .2*saw( f * time ));
};

let lead = ( time: number, tempo: number, f?: number ) =>
{
    f = leadnote[ Math.floor( time / tempo ) % 256/*leadnote.length*/ ];
    time %= tempo;

    let attack = clamp01(100*time);
    let decay = 1. - smoothstep( .1, .3, time );

    return .4 * attack * decay * (.1*sqr( f * time ));
};

let addNote = ( noteFn: (secs: number, tempo: number, cfg0?: number, cfg1?: number) => number, y: Float32Array, tempo: number, cfg0?: number, cfg1?: number ) =>
{
    for (let i = 0; i < s_audioBufferSize; ++i)
    {
        let t = (_sampleOffset + i) / s_audioSampleRate;
        y[i] += noteFn( t, tempo, cfg0, cfg1 );
    }
};

const enum SFX
{
    Boot = 0,
    Reset = 1,
    Collision = 2,
}

let drums = new Float32Array( s_audioBufferSize );
let crtClickIn = new Float32Array( s_audioBufferSize );
let crtClickOut = new Float32Array( s_audioBufferSize );
let rawBass = new Float32Array( s_audioBufferSize );
let outBass = new Float32Array( s_audioBufferSize );
let fullMusicBuffer = new Float32Array( s_audioBufferSize );
let menuMusicBuffer = new Float32Array( s_audioBufferSize );
let engineIn = new Float32Array( s_audioBufferSize );
let engineOut = new Float32Array( s_audioBufferSize );

let bassLpf = biquadFilter();
let menuLpf = biquadFilter();
let engineLpf = biquadFilter();
let clickFilter = biquadFilter();

let audioTick = ( y: Float32Array ) =>
{
    if( _synthMenuMode && _menuModeT > 0 ) _menuModeT = Math.max( 0, _menuModeT - 0.05 );
    if( !_synthMenuMode && _menuModeT < 1 ) _menuModeT = Math.min( 1, _menuModeT + 0.05 );

    _songPos = _sampleOffset / s_audioSampleRate / s_tempo;

    for (let i = 0; i < s_audioBufferSize; ++i)
        drums[i] = rawBass[i] = 0;

    // Bass track
    addNote( pad, rawBass, .25*s_tempo );
    let longWah = _songPos % 64 >= 32;
    let wah = ((_sampleOffset / s_audioSampleRate) % (s_tempo * (longWah?2:1))) * (longWah?1:1);
    bassLpf( (longWah?200:100) + 1500*wah, rawBass, outBass );

    // Drums track
    addNote( kick, drums, s_tempo );
    addNote( sym, drums, .5*s_tempo, .05, 30 );
    addNote( sym, drums, 2*s_tempo, .25, 15 );

    // Lead track
    if( _songPos % 256 >= 128 )
        addNote( lead, drums, .5*s_tempo );

    // Engine sound
    for (let i = 0; i < s_audioBufferSize; ++i)
        engineIn[i] = _menuModeT * .2 * sqr( _engineSoundT += 0.02*_engineSpeed );
    engineLpf( 300, engineIn, engineOut );

    // Compose buffers
    for (let i = 0; i < s_audioBufferSize; ++i)
        fullMusicBuffer[i] = drums[i] + outBass[i] + .8*engineOut[i];

    menuLpf( 200, fullMusicBuffer, menuMusicBuffer );

    if( _sampleOffset < 100000 )
    {
        for (let i = 0; i < s_audioBufferSize; ++i)
            crtClickIn[i] = 1-2*Math.random();
        clickFilter( 4000, crtClickIn, crtClickOut );
        
        addCrtBuzz( menuMusicBuffer, crtClickOut );
    }

    _sampleOffset += s_audioBufferSize;

    for (let i = 0; i < s_audioBufferSize; ++i)
        y[i] = clamp11(.5*(_menuModeT*fullMusicBuffer[i] + (1-_menuModeT)*menuMusicBuffer[i]));
};

// TODO don't need a function to just set a var if we inline the synth module in to index
export let setEngineSoundFromCarSpeed = (speed: number) => _engineSpeed = speed;
export let setSynthMenuMode = (x: 1|0) => _synthMenuMode = x;

export let startAudio = () =>
{
    let ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: s_audioSampleRate }) as AudioContext;
    let node = ctx.createScriptProcessor( s_audioBufferSize, 0, 1 );
    node.connect( ctx.destination );
    node.onaudioprocess = e => audioTick( e.outputBuffer.getChannelData( 0 ));
    startAudio = () => {};
};
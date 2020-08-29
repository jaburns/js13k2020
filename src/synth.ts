declare const s_audioBufferSize: number;
declare const s_audioSampleRate: number;

const TEMPO = .45; 

let _synthMenuMode = false;
let _menuModeT = 0;
let _sampleOffset = 0;

let note = [
    698.48/2,
    698.48/2,
    784/2,
    784/2,

    784/2,
    784/2,
    784/2,
    784/2,

    784/2,
    784/2,
    784/2,
    784/2,

    784/2,
    784/2,
    784/2,
    784/2,
];

let note2 = [
    659.28/2,
    659.28/2,
    698.48/2,
    698.48/2,

    698.48/2,
    698.48/2,
    698.48/2,
    698.48/2,

    698.48/2,
    698.48/2,
    698.48/2,
    698.48/2,

    554.4,
    523.28,
    466.14,
    440
];

const A = 440;
const AS = A * Math.pow(2,1/12);
const B = A * Math.pow(2,2/12);
const C = A * Math.pow(2,3/12);
const CS = A * Math.pow(2,4/12);
const D = A * Math.pow(2,5/12);
const DS = A * Math.pow(2,6/12);
const E = A * Math.pow(2,7/12);
const F = A * Math.pow(2,8/12);
const FS = A * Math.pow(2,9/12);
const G = A * Math.pow(2,10/12);
const GS = A * Math.pow(2,11/12);


// G, F, 2*AS, 
//let ladnote = Array(32).fill(0);


let leadnote = [
    0,0,D, F, G, F, G, F, 
    0,0,0, 0, 0, 0, 0, 0, 
    0,0,D, F, G, F, G, F, 
    2*AS, 0, 0, 0, 0, 0, 0, 0,
    0,0,D, F, G, F, G, F, 
    0, 0, 0, 0, 0, 0, 0, 0,
    0,0,D, F, G, F, G, F, 
    G, F, 2*AS, 2*C, 2*D, 0, 2*C, 2*D,

    2*F,2*G,D, F, G, F, G, F, 
    0,0,0, 0, 0, 0, 0, 0, 
    0,0,D, F, G, F, G, F, 
    2*AS, 0, 0, 0, 0, 0, 0, 0,
    0,0,D, F, G, F, G, F, 
    0, 0, 0, 0, 0, 0, 0, 0,
    0,0,D, F, G, F, G, F, 
    G, F, 2*AS, 2*C, 2*D, 0, 2*C, 2*D,

    2*F,2*G,D, F, G, F, G, F, 
    0,0,0, 0, 0, 0, 0, 0, 
    0,0,D, F, G, F, G, F, 
    2*AS, 0, 0, 0, 0, 0, 0, 0,
    0,0,D, F, G, F, G, F, 
    0, 0, 0, 0, 0, 0, 0, 0,
    0,0,D, F, G, F, G, F, 
    G, F, 2*AS, 2*C, 2*D, 0, 2*C, 2*D,

    2*F,2*G,D, F, G, F, G, F, 
    0,0,D, F, G, F, G, F, 
    G, F, 2*AS, 2*C, 2*D, 0, 2*C, 2*D,
    2*F,2*G,D, F, G, F, G, F, 
    0,0,D, F, G, F, G, F, 
    0,0,D, F, G, F, G, F, 
    2*G, 2*F, 2*D, 2*F, 2*D, 2*C, 2*AS, 2*C,
    2*F, 2*D, 2*C, 2*D, 2*C, 2*AS, G, 2*AS,
];

let biquadFilter = () =>
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

        let b0 = (1 - cs) /2;
        let b1 = 1 - cs;
        let b2 = (1 - cs) /2;

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

        for (let i = 2; i < x.length; ++i)
            y[i] = c0*x[i] + c1*x[i-1] + c2*x[i-2] - c3*y[i-1] - c4*y[i-2];

        x1 = x[x.length - 1];
        x2 = x[x.length - 2];

        y1 = y[x.length - 1];
        y2 = y[x.length - 2];
    };
};


let clamp01 = (x: number) =>
    x < 0 ? 0 : x > 1 ? 1 : x;

let smoothstep = (edge0: number, edge1: number, x: number) =>
{
    x = clamp01((x - edge0) / (edge1 - edge0));
    return x * x * (3 - 2 * x);
};

let sym = ( time: number, tempo: number, a: number, b: number ) =>
    a * (1-2*Math.random()) * Math.exp( -b*(time%tempo) );

let kick = ( time: number, tempo: number ) =>
{
    time %= tempo;
    let attack = clamp01(400*time);
    let decay = 1. - smoothstep( .4, .5, time );
    return .6 * attack * decay * Math.sin( 220. * Math.pow( time, .65 ));
};

let taylorSquareWave = ( x: number, harmonics: number ): number =>
{
    let result = 0;
    for( let i = 1; i <= harmonics; i += 2 )
        result += 4 / Math.PI / i * Math.sin( i * x );
    return result;
};

let saw = ( t: number ) =>
{
    return 1 - 2 * ((t % (2 * Math.PI)) / (2 * Math.PI));
}

let tri = ( t: number ) =>
{
    return 1 - 2*Math.abs(1 - 2 * ((t % (2 * Math.PI)) / (2 * Math.PI)));
}

let sqr = ( t: number ) =>
{
    return saw(t) > 0.5 ? 1 : -1;
}

let pad = ( time: number, tempo: number ) =>
{
    let nn = Math.floor( time / tempo / note.length ) % 4 === 3
        ? note2[ Math.floor( time / tempo ) % note.length ]
        : note[ Math.floor( time / tempo ) % note.length ];
    time %= tempo;

    let ttt = _sampleOffset / s_audioSampleRate / TEMPO;
    let xx = ttt % 128>= 64;
    if(xx) nn *= Math.pow(2, 5/12);


    let attack = clamp01(400*time);
    let decay = 1. - smoothstep( .1, .2, time );
    let f = nn; //  - 100*time;
    return .5 * .8 * attack * decay * (tri( f * time ) + .2*saw( f * time ));
};

let lead = ( time: number, tempo: number ) =>
{
    let nn = leadnote[ Math.floor( time / tempo ) % leadnote.length ];

    time %= tempo;
    let attack = clamp01(100*time);
    let decay = 1. - smoothstep( .1, .3, time );
    let f = nn; //  - 100*time;
    return .4 * attack * decay * (.1*sqr( f * time )); // + .3*tri(.5*f*time));
};

let buffWipe = ( y: Float32Array ) =>
{
    for (let i = 0; i < y.length; ++i)
        y[i] = 0;
};

let addNote = ( noteFn: (secs: number, tempo: number, cfg0?: number, cfg1?: number) => number, y: Float32Array, tempo: number, cfg0?: number, cfg1?: number ) =>
{
    for (let i = 0; i < y.length; ++i)
    {
        let t = (_sampleOffset + i) / s_audioSampleRate;
        y[i] += noteFn( t, tempo, cfg0, cfg1 );
    }
};

let buffAdd = ( x: Float32Array, x1: Float32Array | 0, y: Float32Array ) =>
{
    for (let i = 0; i < y.length; ++i)
        y[i] = x[i] + (x1?x1[i]:0);
};

let buff0 = new Float32Array( s_audioBufferSize );
let rawBass = new Float32Array( s_audioBufferSize );
let outBass = new Float32Array( s_audioBufferSize );
let fullMusicBuffer = new Float32Array( s_audioBufferSize );
let menuMusicBuffer = new Float32Array( s_audioBufferSize );

let bassLpf = biquadFilter();
let menuLpf = biquadFilter();

let fillMusicBuffer = () =>
{
    let ttt = _sampleOffset / s_audioSampleRate / TEMPO;
    let xx = ttt % 64 >= 32;

    buffWipe( rawBass );
    addNote( pad, rawBass, .25*TEMPO );
    let tt = ((_sampleOffset / s_audioSampleRate) % (TEMPO * (xx?2:1))) * (xx?1:1);
    bassLpf( (xx?200:100) + 1500*tt, rawBass, outBass );

    buffWipe( buff0 );
    addNote( kick, buff0, TEMPO );
    addNote( sym, buff0, .5*TEMPO, .05, 30 );
    addNote( sym, buff0, 2*TEMPO, .25, 15 );

    //if(ttt % 256>= 128)
        addNote( lead, buff0, .5*TEMPO );

    buffAdd( buff0, outBass, fullMusicBuffer );
    menuLpf( 200, fullMusicBuffer, menuMusicBuffer );

    _sampleOffset += s_audioBufferSize;
}

let audioTick = ( y: Float32Array ) =>
{
    if( _synthMenuMode && _menuModeT > 0 ) _menuModeT = Math.max( 0, _menuModeT - 0.05 );
    if( !_synthMenuMode && _menuModeT < 1 ) _menuModeT = Math.min( 1, _menuModeT + 0.05 );

    fillMusicBuffer();

    for (let i = 0; i < s_audioBufferSize; ++i)
        y[i] = _menuModeT*fullMusicBuffer[i] + (1-_menuModeT)*menuMusicBuffer[i];
};

export let setSynthMenuMode = () => _synthMenuMode = !_synthMenuMode;

export let startAudio = () =>
{
    let ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: s_audioSampleRate }) as AudioContext;
    let node = ctx.createScriptProcessor( s_audioBufferSize, 0, 1 );
    node.connect( ctx.destination );
    node.onaudioprocess = e => audioTick( e.outputBuffer.getChannelData( 0 ));
    startAudio = () => {};
};

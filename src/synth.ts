declare const s_audioBufferSize: number;
declare const s_audioSampleRate: number;

const TEMPO = .45; 

let _sampleOffset = 0; // 750000;

let clamp01 = (x: number) =>
    x < 0 ? 0 : x > 1 ? 1 : x;

let smoothstep = (edge0: number, edge1: number, x: number) =>
{
    x = clamp01((x - edge0) / (edge1 - edge0));
    return x * x * (3 - 2 * x);
};

let hat = ( time: number, tempo: number ) =>
{
    time %= tempo;
    return (1-2*Math.random()) * Math.exp( -30.*time );
};

let crash = ( time: number, tempo: number ) =>
{
    time %= tempo;
    return (1-2*Math.random()) * Math.exp( -15.*time );
};

let kick = ( time: number, tempo: number ) =>
{
    time %= tempo;
    let attack = clamp01(400*time);
    let decay = 1. - smoothstep( .4, .5, time );
    return attack * decay * Math.sin( 220. * Math.pow( time, .65 ));
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


let ladnote = [
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
    return .8 * attack * decay * (tri( f * time ) + .2*saw( f * time ));
};

let lead = ( time: number, tempo: number ) =>
{
    let nn = ladnote[ Math.floor( time / tempo ) % ladnote.length ];

    time %= tempo;
    let attack = clamp01(100*time);
    let decay = 1. - smoothstep( .1, .3, time );
    let f = nn; //  - 100*time;
    return attack * decay * (.1*sqr( f * time )); // + .3*tri(.5*f*time));
};

type LPF =
{
    update( freq: number, bandwidth: number ): void;
    tick( x: Float32Array, y: Float32Array ): void;
};

let createLPF = (): LPF =>
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
    
    return {
        update: ( freq: number, bandwidth: number ) =>
        {
            let omega = 2 * Math.PI * freq / s_audioSampleRate;
            let sn = Math.sin(omega);
            let cs = Math.cos(omega);
            let alpha = sn * Math.sinh(Math.log(2)/2 * bandwidth * omega / sn);

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
        },
        tick: ( x: Float32Array, y: Float32Array ) =>
        {
            y[0] = c0*x[0] + c1*x1 + c2*x2 - c3*y1 - c4*y2;
            y[1] = c0*x[1] + c1*x[0] + c2*x1 - c3*y[0] - c4*y1;

            for (let i = 2; i < x.length; ++i)
                y[i] = c0*x[i] + c1*x[i-1] + c2*x[i-2] - c3*y[i-1] - c4*y[i-2];

            x1 = x[x.length - 1];
            x2 = x[x.length - 2];

            y1 = y[x.length - 1];
            y2 = y[x.length - 2];
        },
    };
};

let buffWipe = ( y: Float32Array ) =>
{
    for (let i = 0; i < y.length; ++i)
        y[i] = 0;
};

let addNote = ( noteFn: (secs: number, tempo: number) => number, y: Float32Array, tempo: number, volume: number ) =>
{
    for (let i = 0; i < y.length; ++i)
    {
        let t = (_sampleOffset + i) / s_audioSampleRate;
        y[i] += volume * noteFn( t, tempo );
    }
};

let buffAdd = ( x: Float32Array, x1: Float32Array, y: Float32Array ) =>
{
    for (let i = 0; i < y.length; ++i)
        y[i] = x[i] + x1[i];
};

let buff0 = new Float32Array( s_audioBufferSize );
let rawSaw = new Float32Array( s_audioBufferSize );
let outSaw = new Float32Array( s_audioBufferSize );
let preLpf = new Float32Array( s_audioBufferSize );

let lpf = createLPF();
let lpf2 = createLPF(), LLL = false;
lpf2.update( 400, 4 );

let audioTick = ( y: Float32Array ) =>
{
    let ttt = _sampleOffset / s_audioSampleRate / TEMPO;
    let xx = ttt % 64 >= 32;

    buffWipe( rawSaw );
    addNote( pad, rawSaw, .25*TEMPO, .5 );
    let tt = ((_sampleOffset / s_audioSampleRate) % (TEMPO * (xx?2:1))) * (xx?1:1);
    lpf.update( (xx?200:100) + 1500*tt, 2 );
    lpf.tick( rawSaw, outSaw );

    buffWipe( buff0 );
    addNote( kick, buff0, 1*TEMPO, .6 );
    addNote( hat, buff0, .5*TEMPO, .05 );
    addNote( crash, buff0, 2*TEMPO, .25 );

    if(ttt % 256>= 128)
        addNote( lead, buff0, .5*TEMPO, .4 );

    if( LLL )
    {
        buffAdd( buff0, outSaw, preLpf );
        lpf2.tick( preLpf, y );
    }
    else 
        buffAdd( buff0, outSaw, y );


    _sampleOffset += y.length;
};

export let startAudio = () =>
{
    let ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: s_audioSampleRate }) as AudioContext;
    let node = ctx.createScriptProcessor( s_audioBufferSize, 0, 1 );
    node.connect( ctx.destination );
    node.onaudioprocess = e => audioTick( e.outputBuffer.getChannelData( 0 ));
    startAudio = () => {};
};

/*
let KICKS = [ 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0 ];
let HATS =  [ 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1 ];

let clamp = (x: number, lowerlimit: number, upperlimit: number) =>
{
    if (x < lowerlimit) x = lowerlimit;
    if (x > upperlimit) x = upperlimit;
    return x;
};

let smoothstep = (edge0: number, edge1: number, x: number) =>
{
    x = clamp((x - edge0) / (edge1 - edge0), 0, 1); 
    return x * x * (3 - 2 * x);
};

let latestStartTime = ( time: number, track: number[] ): number =>
{
    time *= 4.;
    let result = -10.;
    
    for( let i = 0; i < track.length; ++i ) {
        let t = i;
        if( t >= time ) break;
        if( track[i] > 0 ) result = t;
    }
    
    return result / 4.;
}

let taylorSquareWave = ( x: number, harmonics: number ): number =>
{
    let result = 0;
    for( let i = 1; i <= harmonics; i += 2 )
        result += 4 / Math.PI / i * Math.sin( i * x );
    return result;
};

let kick = ( time: number ) =>
{
    let attack = clamp( 400.*time, 0., 1. );
    let decay = 1. - smoothstep( .4, .5, time );
    return attack * decay * Math.sin( 220. * Math.pow( time, .65 ));
};

let hat = ( time: number ) =>
{
    return .33 * Math.random() * Math.exp( -30.*time );
};

let signal = ( time: number ) =>
{
    let t = time % (HATS.length / 4.);
    let padF = 32.;

    return 1.00 * kick( t - latestStartTime( t, KICKS )) +
        0.50 * hat( t - latestStartTime( t, HATS )) +
        0.25 * 1 * taylorSquareWave( 2. * Math.PI * (padF + 2.) * time, 5 ) +
        (t > HATS.length / 8 ? 0.7 : 0) * 1 * Math.sin( 4. * Math.PI * padF * time );
};

export let startAudio = () =>
{
    let ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: s_audioSampleRate }) as AudioContext;
    let node = ctx.createScriptProcessor( s_audioBufferSize, 0, 1 );
    node.connect( ctx.destination );
    node.onaudioprocess = e =>
    {
        let buffer = e.outputBuffer.getChannelData( 0 );

    // ----- Audio buffer fill -------------------------

        for( let i = 0; i < buffer.length; ++i )
            buffer[i] = signal( _audioT += 1 / s_audioSampleRate );

    // -------------------------------------------------
    };

    startAudio = () => {};
};
*/
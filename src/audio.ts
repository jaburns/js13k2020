declare const s_audioBufferSize: number;

const SAMPLE_RATE = 22050;

let t = 0;
let started = 0;

const taylorSquareWave = (x: number, harmonics: number): number =>
{
    let result = 0;
    for( let i = 1; i <= harmonics; i += 2 )
        result += 4 / Math.PI / i * Math.sin( i * x );
    return result;
};


const soundTick = (buffer: Float32Array) =>
{
    for( let i = 0; i < buffer.length; ++i )
        buffer[i] = taylorSquareWave( t += 0.005 + 0.001*Math.sin(t/1000), 10 );
};

export const tryStartAudio = () =>
{
    if(!started)
    {
        started = 1;
        let ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE }) as AudioContext;
        console.log(ctx.sampleRate);
        let node = ctx.createScriptProcessor( s_audioBufferSize, 0, 1 );
        node.onaudioprocess = e => soundTick( e.outputBuffer.getChannelData(0) );
        node.connect( ctx.destination );
    }
};
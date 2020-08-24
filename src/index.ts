import { gfxDrawGame, gfxStepState } from './gfx';
import { inputSample } from './input';

let TICK_LENGTH_MILLIS = 33.3;

let previousTime = performance.now();
let tickAccTime = 0;

let frame = () =>
{
    requestAnimationFrame( frame );

    let newTime = performance.now();
    let deltaTime = newTime - previousTime;
    previousTime = newTime;

    tickAccTime += deltaTime;
    while( tickAccTime >= TICK_LENGTH_MILLIS )
    {
        tickAccTime -= TICK_LENGTH_MILLIS;

        let inputs = inputSample();
        gfxStepState( inputs );
    }

    gfxDrawGame( tickAccTime / TICK_LENGTH_MILLIS );
};

frame();
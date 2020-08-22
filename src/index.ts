import { gfxDrawGame } from './gfx';
import { GameState, stateNew, stateStep } from './state';
import { inputSample } from './input';

let TICK_LENGTH_MILLIS = 33.3;

let previousTime = performance.now();
let tickAccTime = 0;
let prevState: GameState = stateNew();
let curState: GameState = stateNew();

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

        prevState = curState;
        curState = stateStep( curState, inputs );
    }

    gfxDrawGame( prevState, curState, tickAccTime / TICK_LENGTH_MILLIS );
};

frame();
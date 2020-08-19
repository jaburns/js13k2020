import { gfxInit } from './gfx';
import { GameState, stateNew, stateStep } from './state';
import { renderGame } from './render';
import { inputInit, inputSample } from './input';

const TICK_LENGTH_MILLIS = 33.3;

let previousTime = performance.now();
let tickAccTime = 0;
let prevState: GameState = stateNew();
let curState: GameState = stateNew();

const frame = () =>
{
	requestAnimationFrame( frame );

    const newTime = performance.now();
    const deltaTime = newTime - previousTime;
    previousTime = newTime;

	tickAccTime += deltaTime;
	while( tickAccTime >= TICK_LENGTH_MILLIS )
	{
		tickAccTime -= TICK_LENGTH_MILLIS;

		const inputs = inputSample();

		prevState = curState;
		curState = stateStep( curState, inputs );
	}

	renderGame( prevState, curState, tickAccTime / TICK_LENGTH_MILLIS );
};

inputInit();
gfxInit();
frame();
import { InputState, Action_Down } from "./input";
import { gfxSampleSDF, sdfSampleResults } from "./gfx";

export type GameState =
{
    tick: number,
};

export let stateNew = (): GameState =>
({
    tick: 0,
})

export let stateStep = ( previous: GameState, inputs: InputState ): GameState =>
{
    let state = JSON.parse(JSON.stringify( previous )) as GameState;

    state.tick++;

    if( inputs.started[ Action_Down ])
    {
        gfxSampleSDF();
        console.log( sdfSampleResults );
    }

    return state;
};
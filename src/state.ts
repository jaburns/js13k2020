import { InputState, Action_Down } from "./input";

export type GameState =
{
    tick: number,
};

export const stateNew = (): GameState =>
({
    tick: 0,
})

export const stateStep = ( previous: GameState, inputs: InputState ): GameState =>
{
    const state = JSON.parse(JSON.stringify( previous )) as GameState;

    state.tick++;

    if( inputs.actionStarted[ Action_Down ])
        console.log('X');

    return state;
};
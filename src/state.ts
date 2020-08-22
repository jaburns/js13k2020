import { InputState, Action_Down } from "./input";

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
        console.log('X');

    if( inputs.held[ Action_Down ])
        console.log('.');

    if( inputs.ended[ Action_Down ])
        console.log('O');

    return state;
};
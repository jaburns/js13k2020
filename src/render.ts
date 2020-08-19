import { GameState } from "./state";

export const renderGame = ( prevState: GameState, curState: GameState, lerpTime: number ) =>
{
    console.log( curState.tick + (curState.tick - prevState.tick) * lerpTime );
};
import { GameState } from "./state";
import { gfxDrawCube } from "./gfx";

export const renderGame = ( prevState: GameState, curState: GameState, lerpTime: number ) =>
{
    gfxDrawCube( curState.tick + (curState.tick - prevState.tick) * lerpTime );
};
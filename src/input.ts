export const Action_Up = 0;
export const Action_Down = 1;
export const Action_Left = 2;
export const Action_Right = 3;

type ActionSet = {[k: number]: true};

export type InputState =
{
    actionStarted: ActionSet,
    actionHeld: ActionSet,
    actionEnded: ActionSet,
};

let lastKeysDown: {[k: string]: true} = {};
const keysDown: {[k: string]: true} = {};

export const inputInit = () =>
{
    document.addEventListener('keydown', k => keysDown[k.keyCode] = true);
    document.addEventListener('keyup', k => delete keysDown[k.keyCode]);
};

export const inputSample = (): InputState =>
{
    const actionsForKeys: {[k:number]: number} = {
        38: Action_Up,
        40: Action_Down,
        37: Action_Left,
        39: Action_Right,
    };

    const result: InputState = {
        actionStarted: {},
        actionHeld: {},
        actionEnded: {},
    };

    for( let k in actionsForKeys )
    {
        if( keysDown[k] )
        {
            result.actionHeld[actionsForKeys[k]] = true;
            if( !lastKeysDown[k] )
                result.actionStarted[actionsForKeys[k]] = true;
        }
        else if( lastKeysDown[k] )
            result.actionEnded[actionsForKeys[k]] = true;
    }

    lastKeysDown = JSON.parse(JSON.stringify( keysDown ));

    return result;
};
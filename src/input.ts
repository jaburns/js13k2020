export const Action_Up = 38; // key: up
export const Action_Down = 40; // key: down
export const Action_Left = 37; // key: left
export const Action_Right = 39; // key: right

export type InputState =
{
    started: {[k: number]: true},
    held: {[k: number]: true},
    ended: {[k: number]: true},
};

let lastHeld: {[k: number]: true} = {};
let held: {[k: number]: true} = {};

export const inputInit = () =>
{
    document.addEventListener('keydown', k => held[k.keyCode] = true);
    document.addEventListener('keyup', k => delete held[k.keyCode]);
};

export const inputSample = (): InputState =>
{
    const result: InputState = {
        started: {}, held, ended: {},
    };

    for( let k in held )
        if( !lastHeld[k] )
            result.started[k] = true;

    for( let k in lastHeld )
        if( !held[k] )
            result.ended[k] = true;

    lastHeld = JSON.parse(JSON.stringify( held ));

    return result;
};
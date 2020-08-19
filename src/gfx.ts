declare const a: HTMLCanvasElement;
declare const g: WebGLRenderingContext;

const onResize = () =>
{
    a.width = window.innerWidth;
    a.height = window.innerHeight;
    g.viewport( 0, 0, a.width, a.height );
};

export const gfxInit = () =>
{
    window.onresize = onResize;

    onResize();

    g.clearColor(0,1,0,1);
    g.clear(g.COLOR_BUFFER_BIT);
};
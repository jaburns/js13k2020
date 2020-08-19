declare const g: WebGLRenderingContext;

export const boot = () =>
{
    g.clearColor(0,1,0,1);
    g.clear(g.COLOR_BUFFER_BIT);

    let prog = g.createProgram()!;
    let shader = g.createShader(g.VERTEX_SHADER)!;
    g.shaderSource(shader, '');
    g.compileShader(shader);
    g.attachShader(prog, shader);
};
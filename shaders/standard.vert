attribute vec2 a_position;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

varying vec2 v_normal;
varying vec2 v_position;

void main()
{
    gl_Position = vec4(a_position, 0, 1);
	doge += 1;
    v_uv = a_position.xy*0.5 + 0.5 + doge;
}
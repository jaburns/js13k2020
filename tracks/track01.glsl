// Generated by track editor Unity project
const vec3 Xc0 = vec3(0.6,9.42,53.7),Xc1 = vec3(-117.1,34,169.28),Xc2 = vec3(-68.2,23.38,169.28),Xc3 = vec3(-7.1,21.79,152.5);
const vec4 Xf0 = vec4(0,0,0,1),Xf1 = vec4(0,-0.707,0,0.707),Xf2 = vec4(0,-0.707,0,0.707),Xf3 = vec4(0,-0.925,0,0.379),Xp0 = vec4(63.9,24.3,8.7,50.67),Xp1 = vec4(0);
vec2 Xm( vec3 p )
{
vec2 d = vec2( 10000, 0 );
if( mod( g_traceBits.x / i_BIT6, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.087,0.,0.,0.996,0.5,16.006,129.024 ,10.,40.,-0.5,1.,2. ) );
if( mod( g_traceBits.x / i_BIT7, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.087,0.,0.,0.996,0.5,9.07,89.63 ,10.,20.,-80.,2.,1. ) );
if( mod( g_traceBits.x / i_BIT8, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.,0.,1.,0.5,9.07,-10.24 ,10.,50.,0.,2.,1. ) );
if( mod( g_traceBits.x / i_BIT9, 2. ) >= 1. )
{
vec2 d1 = opSmoothUnion2(sdObj1( p, -0.18,-0.684,0.18,0.684,-89.05,26.4,168.47 ,10.,4.11,59.5,2.,1. ),sdObj1( p, 0.,-0.707,0.,0.707,-84.17,22.95,168.47 ,10.,22.5,66.5,2.,1. ),2.);
d = min2( d, d1 );
}
return d;
}
float Xt( vec3 ro, vec3 rd, float dist )
{
traceBox( ro, rd, dist, g_traceBits.x, i_BIT6, 0.087,0.,0.,0.996,-14.,16.006,129.024,26.5,12.,26.5 );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT7, 0.087,0.,0.,0.996,0.5,9.07,89.63,11.,11.,21. );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT8, 0.,0.,0.,1.,0.5,9.07,-10.24,11.,1.5,51. );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT9, 0.,-0.707,0.,0.707,-91.68,22.95,168.47,14.7,15.21,30.45 );
return dist < 10000. ? dist : -1.;
}

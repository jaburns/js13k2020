// Generated by track editor Unity project
const vec3 Xc0 = vec3(-120.51,20.33,239.8),Xc1 = vec3(-113.7,78.54,452.5),Xc2 = vec3(-192.95,17.99,341.16),Xc3 = vec3(-46.51,6.94,177.52);
const vec4 Xf0 = vec4(0,0.361,0,0.932),Xf1 = vec4(-0.707,0,0,0.707),Xf2 = vec4(0,0,0,1),Xf3 = vec4(0,0.423,0,0.906),Xp0 = vec4(-140.3,65,425.3,50),Xp1 = vec4(0);
vec2 Xm( vec3 p )
{
vec2 d = vec2( 10000, 0 );
if( mod( g_traceBits.x / i_BIT6, 2. ) >= 1. )
d = min2( d, sdObj2( p, -0.271,-0.271,-0.653,0.653,-148.684,17.3,418.106 ,10.,-50.,1.57,1.,2. ) );
if( mod( g_traceBits.x / i_BIT7, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.,0.383,0.,0.924,-169.826,17.3,283.826 ,7.5,-80.,0.,0.,6. ) );
if( mod( g_traceBits.x / i_BIT8, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.383,0.,0.924,-127.4,17.3,241.4 ,10.,30.,0.,2.,1. ) );
if( mod( g_traceBits.x / i_BIT9, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,-0.383,0.,0.924,-169.968,17.3,396.822 ,10.,15.,0.,2.,1. ) );
if( mod( g_traceBits.y / i_BIT0, 2. ) >= 1. )
d = min2( d, sdObj4( p, 0.707,0.405,0.018,0.58,-21.8,4.9,147. ,5.,2.5 ) );
if( mod( g_traceBits.y / i_BIT1, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.,0.,1.,0.5,9.,25. ,10.,25.,-80.,2.,0. ) );
if( mod( g_traceBits.y / i_BIT2, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.,0.,1.,0.5,9.,-5. ,10.,15.,0.,2.,1. ) );
if( mod( g_traceBits.y / i_BIT3, 2. ) >= 1. )
d = min2( d, sdObj4( p, 0.684,0.319,-0.145,0.64,-1.77,6.64,124.77 ,5.,5. ) );
if( mod( g_traceBits.y / i_BIT4, 2. ) >= 1. )
{
vec2 d1 = opSubtract2(sdObj4( p, 0.698,0.468,0.029,0.541,-33.1,7.5,189.7 ,6.889,10. ),sdObj2( p, 0.,0.,0.,1.,0.5,9.,75. ,10.,150.,-0.63,0.,2. ),6.);
d = min2( d, d1 );
}
return d;
}
float Xt( vec3 ro, vec3 rd, float dist )
{
traceBox( ro, rd, dist, g_traceBits.x, i_BIT6, -0.271,-0.271,-0.653,0.653,-148.684,36.8,418.106,31.5,12.,31.5 );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT7, 0.,0.383,0.,0.924,-144.547,17.3,309.106,45.25,9.5,45.25 );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT8, 0.,0.383,0.,0.924,-127.4,17.3,241.4,11.,1.5,31. );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT9, 0.,-0.383,0.,0.924,-169.968,17.3,396.822,11.,1.5,16. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT0, 0.707,0.405,0.018,0.58,-21.8,4.9,147.,5.,5.,7.5 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT1, 0.,0.,0.,1.,0.5,9.,25.,11.,11.,26. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT2, 0.,0.,0.,1.,0.5,9.,-5.,11.,1.5,16. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT3, 0.684,0.319,-0.145,0.64,-1.77,6.64,124.77,10.,10.,10. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT4, 0.,0.,0.,1.,0.5,9.,75.,160.,20.,100. );
return dist < 10000. ? dist : -1.;
}

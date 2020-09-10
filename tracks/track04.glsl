// Generated by track editor Unity project
const vec3 Xc0 = vec3(0.44,0.13,53.7),Xc1 = vec3(23.56,8.03,162.8),Xc2 = vec3(65.47,7.93,166.48),Xc3 = vec3(122.56,9.77,207.71);
const vec4 Xf0 = vec4(0,0,0,1),Xf1 = vec4(0.12,-0.468,0.199,0.853),Xf2 = vec4(0.07,-0.704,0.07,0.704),Xf3 = vec4(0,-0.277,0,0.961),Xp0 = vec4(115.4,9.6,199.1,22.3);
vec2 Xmap( vec3 p )
{
vec2 d = vec2( 10000, 0 );
if( mod( g_traceBits.y / i_BIT0, 2. ) >= 1. )
d = min2( d, sdObj0( quat(0.119,0.,0.,0.993)*(p-vec3(0.5,-2.19,-39.91)), vec3(3.549,0.5,5.093)  ) );
if( mod( g_traceBits.y / i_BIT1, 2. ) >= 1. )
d = min2( d, sdObj0( quat(-0.25,-0.551,-0.688,0.401)*(p-vec3(-71,-9.6,127.4)), vec3(18.917,18.917,18.917)  ) );
if( mod( g_traceBits.y / i_BIT2, 2. ) >= 1. )
d = min2( d, sdObj1( quat(0.,0.,0.,1.)*(p-vec3(0.5,8.2,86.35)), vec3(4,0.5,20) ,80. ) );
if( mod( g_traceBits.y / i_BIT3, 2. ) >= 1. )
d = min2( d, sdObj0( quat(0.109,-0.195,-0.44,0.87)*(p-vec3(19.63,-2.73,93.83)), vec3(5,5,5)  ) );
if( mod( g_traceBits.y / i_BIT4, 2. ) >= 1. )
d = min2( d, sdObj0( quat(0.,0.,0.,1.)*(p-vec3(115.1,-9.6,179.6)), vec3(20,20,20)  ) );
if( mod( g_traceBits.y / i_BIT5, 2. ) >= 1. )
d = min2( d, sdObj2( quat(0.,0.,0.,1.)*(p-vec3(0.5,8.2,126.32)), vec3(4,0.5,20) ,-40.,-0.5 ) );
if( mod( g_traceBits.y / i_BIT6, 2. ) >= 1. )
d = min2( d, sdObj1( quat(0.,0.707,0.,0.707)*(p-vec3(80.5,8.2,166.31)), vec3(4,0.5,20) ,-80. ) );
if( mod( g_traceBits.y / i_BIT7, 2. ) >= 1. )
{
vec2 d1 = opSmoothUnion2(sdObj1( quat(0.,0.,0.,1.)*(p-vec3(0.5,0.21,-30.12)), vec3(4,0.5,50) ,0. ),sdObj0( quat(0.313,0.,0.,0.95)*(p-vec3(0.5,-2.69,62.28)), vec3(2.29,0.5,5.093)  ),2.);
d = min2( d, d1 );
}
return d;
}
float Xtrace( vec3 ro, vec3 rd, float dist )
{
float hit;
hit = traceBox( quat(0.119,0.,0.,0.993)*(ro-vec3(0.5,-2.19,-39.91)), quat(0.119,0.,0.,0.993)*rd, vec3(3.549,0.5,5.093) );
if( hit >= 0. ) { g_traceBits.y += i_BIT0; if( hit < dist ) dist = hit; }
hit = traceBox( quat(-0.25,-0.551,-0.688,0.401)*(ro-vec3(-71,-9.6,127.4)), quat(-0.25,-0.551,-0.688,0.401)*rd, vec3(18.917,18.917,18.917) );
if( hit >= 0. ) { g_traceBits.y += i_BIT1; if( hit < dist ) dist = hit; }
hit = traceBox( quat(0.,0.,0.,1.)*(ro-vec3(0.5,8.2,86.35)), quat(0.,0.,0.,1.)*rd, vec3(5,5,21) );
if( hit >= 0. ) { g_traceBits.y += i_BIT2; if( hit < dist ) dist = hit; }
hit = traceBox( quat(0.109,-0.195,-0.44,0.87)*(ro-vec3(19.63,-2.73,93.83)), quat(0.109,-0.195,-0.44,0.87)*rd, vec3(5,5,5) );
if( hit >= 0. ) { g_traceBits.y += i_BIT3; if( hit < dist ) dist = hit; }
hit = traceBox( quat(0.,0.,0.,1.)*(ro-vec3(115.1,-9.6,179.6)), quat(0.,0.,0.,1.)*rd, vec3(20,20,20) );
if( hit >= 0. ) { g_traceBits.y += i_BIT4; if( hit < dist ) dist = hit; }
hit = traceBox( quat(0.,0.,0.,1.)*(ro-vec3(18.5,8.2,126.32)), quat(0.,0.,0.,1.)*rd, vec3(23,5,23) );
if( hit >= 0. ) { g_traceBits.y += i_BIT5; if( hit < dist ) dist = hit; }
hit = traceBox( quat(0.,0.707,0.,0.707)*(ro-vec3(80.5,8.2,166.31)), quat(0.,0.707,0.,0.707)*rd, vec3(5,5,21) );
if( hit >= 0. ) { g_traceBits.y += i_BIT6; if( hit < dist ) dist = hit; }
hit = traceBox( quat(0.,0.,0.,1.)*(ro-vec3(0,1.07,-30.16)), quat(0.,0.,0.,1.)*rd, vec3(6,3,51) );
if( hit >= 0. ) { g_traceBits.y += i_BIT7; if( hit < dist ) dist = hit; }
return dist < 10000. ? dist : -1.;
}

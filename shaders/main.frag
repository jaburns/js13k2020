uniform vec2 u_resolution;
uniform sampler2D u_state;
uniform sampler2D u_prevState;
uniform float u_time;
uniform float u_lerpTime;
uniform bool u_modeState;
uniform bool u_modeTitle;
uniform vec4 u_inputs;

vec3 g_state[14];
vec3 g_carCenterPt;
vec3 g_carForwardDir;
vec3 g_carDownDir;
vec3 g_steerForwardDir;
mat3 g_wheelRot;
mat3 g_steerRot;

const float i_EPS = 0.01;
const float i_PI = 3.14159;
const float i_PRECISION = 1.;
const int i_ITERATIONS = 150;

vec2 mul( mat2 m, vec2 v )
{
    return m * v; // TODO move this notation conversion in to the build process
}

#pragma INCLUDE_WORLD_SDF

mat3 transpose( mat3 m )
{
    return mat3(
        m[0][0], m[1][0], m[2][0],
        m[0][1], m[1][1], m[2][1],
        m[0][2], m[1][2], m[2][2]
    );
}

float sdTorus( vec3 p, vec2 t )
{
    vec2 q = vec2(length(p.zy)-t.x,p.x);
    return length(q)-t.y;
}

float sdWheel( vec3 p, vec3 pos, mat3 rot )
{
    return sdTorus( rot*(p - pos), vec2( .3, .2));
}

float sdBody( vec3 p )
{
    return sdBox( g_wheelRot*(p - g_carCenterPt), vec3(.4, .2, 1.));
}

vec2 map( vec3 p )
{
    vec2 world = track( p );
    world = min2( world, vec2(p.y,2) );

    if( u_modeState ) return world;

    world = min2( world, vec2(sdBody(p),3));
    world = min2( world, vec2(sdWheel( p , ST.wheelPos[0], g_wheelRot ),3));
    world = min2( world, vec2(sdWheel( p , ST.wheelPos[1], g_wheelRot ),3));
    world = min2( world, vec2(sdWheel( p , ST.wheelPos[2], g_steerRot ),3));
    world = min2( world, vec2(sdWheel( p , ST.wheelPos[3], g_steerRot ),3));

    return world;
}


vec3 getNorm(vec3 p)
{
    vec2 e = vec2(0.001, 0);
    return normalize(vec3(
        map(p + e.xyy).x - map(p - e.xyy).x,
        map(p + e.yxy).x - map(p - e.yxy).x,
        map(p + e.yyx).x - map(p - e.yyx).x));
}

vec3 lossyReflect( vec3 v, vec3 n, vec3 guess_u, float bounce, float frictionU, float frictionV )
{
    vec3 tan_v = normalize( cross( n, guess_u ));
    vec3 tan_u = cross( n, tan_v );

    float v_n = -bounce * dot( v, n );
    float v_u = frictionU * dot( v, tan_u );
    float v_v = frictionV * dot( v, tan_v );

    return v_n*n + v_u*tan_u + v_v*tan_v;
}

void distConstraint( inout vec3 pos0, inout vec3 pos1, float dist )
{
    vec3 iToJ = pos0 - pos1;
    vec3 fixVec = .5 * (dist - length(iToJ)) * normalize( iToJ );
    pos0 += fixVec;
    pos1 -= fixVec;
}

void initGlobals()
{
    g_carDownDir = normalize(
        normalize(cross( ST.wheelPos[0] - ST.wheelPos[3], ST.wheelPos[2] - ST.wheelPos[3] )) -
        normalize(cross( ST.wheelPos[0] - ST.wheelPos[1], ST.wheelPos[2] - ST.wheelPos[1] ))
    );

    if( g_carDownDir.y > 0. ) g_carDownDir *= -1.;

    g_carForwardDir = normalize( ST.wheelPos[2] - ST.wheelPos[1] );
    g_carCenterPt = ( ST.wheelPos[0] + ST.wheelPos[1] + ST.wheelPos[2] + ST.wheelPos[3] ) / 4.;

    mat3 wheelRotFwd = mat3( cross( g_carDownDir, g_carForwardDir ), g_carDownDir, g_carForwardDir );
    g_wheelRot = transpose( wheelRotFwd );

    g_steerForwardDir = vec3( 0, 0, 1 );
    g_steerForwardDir.xz *= rot( ST.steeringState.x );
    g_steerForwardDir = wheelRotFwd * g_steerForwardDir;

    g_steerRot = transpose( mat3( cross( g_carDownDir, g_steerForwardDir ), g_carDownDir, g_steerForwardDir ));
}

void m1()
{
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)).xyz;

    ST.steeringState.x = u_modeTitle ? 0. : u_inputs.z > 0. ? i_PI/32. : u_inputs.w > 0. ? -i_PI / 32. : 0.;

    initGlobals();

// ----- State update -----

    for( int i = 0; i < 4; ++i )
    {
        vec3 posStep = ST.wheelPos[i] - ST.wheelLastPos[i]  + (ST.wheelForceCache[i] - vec3(0,9.81,0)) / s_sqrTicksPerSecond.;
        ST.wheelLastPos[i] = ST.wheelPos[i];
        ST.wheelPos[i] += posStep;
        ST.wheelForceCache[i] = vec3( 0 );

        float dist = map( ST.wheelPos[i] ).x;
        vec3 normal = getNorm( ST.wheelPos[i] );

        if( dist < .5 )
        {
            ST.wheelPos[i] += (.5-dist)*normal;

            vec3 vel = ST.wheelPos[i] - ST.wheelLastPos[i];
            vel = lossyReflect( vel, normal, i < 2 ? g_carForwardDir : g_steerForwardDir, .2, 1., .1 );
            ST.wheelLastPos[i] = ST.wheelPos[i] - vel;

            if( u_modeTitle && ST.wheelPos[i].z < -9999. || u_inputs.x > 0. || u_inputs.y > 0. )
            {
                vec3 xs = cross( normal, i < 2 ? g_carForwardDir : g_steerForwardDir );
                vec3 groundedFwd = normalize( cross( xs, normal ));
                ST.wheelForceCache[i] = 10. * groundedFwd * ( u_modeTitle || u_inputs.x > 0. ? 1. : -.5 );
            }
        }
    }

    distConstraint( ST.wheelPos[0], ST.wheelPos[1], s_wheelBaseWidth );
    distConstraint( ST.wheelPos[0], ST.wheelPos[2], sqrt(s_wheelBaseWidth*s_wheelBaseWidth + s_wheelBaseLength*s_wheelBaseLength) );
    distConstraint( ST.wheelPos[0], ST.wheelPos[3], s_wheelBaseLength );
    distConstraint( ST.wheelPos[1], ST.wheelPos[2], s_wheelBaseLength );
    distConstraint( ST.wheelPos[1], ST.wheelPos[3], sqrt(s_wheelBaseWidth*s_wheelBaseWidth + s_wheelBaseLength*s_wheelBaseLength) );
    distConstraint( ST.wheelPos[2], ST.wheelPos[3], s_wheelBaseWidth );

// ------------------------

    for( int i = 0; i < s_totalStateSize; ++i )
    {
        if( gl_FragCoord.x < float(i+1) )
        {
            gl_FragColor = vec4(g_state[i],0);
            return;
        }
    }
}

// float shadowMarch( in vec3 ro, in vec3 rd, float mint, float maxt )
// {
//     float k = 20.;
//     float res = 1.0;
//     float t = mint;
// 
//     for( int i = 0; i < i_ITERATIONS; ++i )
//     {
//         if( t >= maxt ) break;
//         vec2 h = map(ro + rd*t);
//         if( h.x < 0.001 ) return 0.0;
//         res = min( res, k*h.x/t );
//         t += h.x;
//     }
// 
//     return res;
// }

void m0()
{
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = mix(
            texture2D(u_prevState, vec2( (float(i)+.5)/s_totalStateSize.)),
            texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)),
            u_lerpTime ).xyz;

    initGlobals();

    vec2 uv = (gl_FragCoord.xy - .5*u_resolution)/u_resolution.y;

    vec3 ro, lookAt;
    if( u_modeTitle )
    {
        ro = vec3(10,10,80);
        lookAt = g_carCenterPt + vec3(0,1,0);
    }
    else
    {
        vec3 fwdxz = normalize(vec3(g_carForwardDir.x, 0, g_carForwardDir.z));
        ro = g_carCenterPt + vec3(0,2,0) - 7.*fwdxz;
        lookAt = g_carCenterPt + vec3(0,1,0);
    }

    float zoom = 1.;
    //vec3 ro = vec3(0);
    vec3 upGuess = vec3(0,1,0);
    vec3 f = normalize(lookAt - ro);
    //vec3 r = normalize(cross(-g_carDownDir, f));
    vec3 r = normalize(cross(upGuess, f));
    vec3 u = cross(f, r);
    vec3 c = ro + f * zoom;
    vec3 i = c + uv.x * r + uv.y * u;
    vec3 rd = normalize(i - ro);

    vec2 dist;
    float totalDist = 0.0;
    
    for( int i = 0; i < i_ITERATIONS; ++i )
    {
        dist = map( ro );
        if( dist.x < i_EPS || totalDist >= 200. ) break;
        // totalDist += i_PRECISION * dist.x;
        // ro += i_PRECISION * rd * dist.x;
        totalDist += i_PRECISION * dist.x;
        ro += i_PRECISION * rd * dist.x;
    }

    if( dist.x < i_EPS )
    {
        vec3 norm = getNorm( ro );
        float packDist = (norm.z > 0. ? 1. : -1.) * totalDist;
        gl_FragColor = vec4( norm.xy, packDist, dist.y );
    }
    else
    {
        gl_FragColor = vec4( 0, 0, 200, 0 );
    }
}
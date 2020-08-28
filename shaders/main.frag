uniform vec2 u_resolution;
uniform sampler2D u_state;
uniform sampler2D u_prevState;
uniform sampler2D u_canvas;
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

// ----- From Shane's "Jagged Plain" demo: https://www.shadertoy.com/view/4tSXRm -----
vec3 tri( vec3 x )
{
    return abs(x-floor(x)-.5);
} 
float surfFunc( vec3 p )
{
    float n = dot(tri(p*.15 + tri(p.yzx*.075)), vec3(.444));
    p = p*1.5773 - n;
    p.yz = vec2(p.y + p.z, p.z - p.y) * .866;
    p.xz = vec2(p.x + p.z, p.z - p.x) * .866;
    n += dot(tri(p*.225 + tri(p.yzx*.1125)), vec3(.222));     
    return abs(n-.5)*1.9 + (1.-abs(sin(n*9.)))*.05;
}
// -----------------------------------------------------------------------------------


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

struct March
{
    vec3 pos;
    float dist;
    float mat;
    float ao;
};

March march( vec3 ro, vec3 rd )
{
    vec2 dist;
    float totalDist = 0.0;
    
    int j = 0;
    for( int i = 0; i < i_ITERATIONS; ++i )
    {
        j = i;
        dist = map( ro );
        if( dist.x < i_EPS || totalDist > 200. ) break;
        totalDist += i_PRECISION * dist.x;
        ro += i_PRECISION * rd * dist.x;
    }
    
    return March( ro, dist.x < i_EPS ? totalDist : -1.0, dist.y, float(j) / 90. );
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

            if( u_modeTitle && ST.wheelPos[i].z < 20. || u_inputs.x > 0. || u_inputs.y > 0. )
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

float shadowMarch( in vec3 ro, in vec3 rd, float mint, float maxt )
{
    float k = 20.;
    float res = 1.0;
    float t = mint;

    for( int i = 0; i < i_ITERATIONS; ++i )
    {
        if( t >= maxt ) break;
        vec2 h = map(ro + rd*t);
        if( h.x < 0.001 ) return 0.0;
        res = min( res, k*h.x/t );
        t += h.x;
    }

    return res;
}

//let togl = (x) => {let r = x.substr(0,2),g=x.substr(2,2),b=x.substr(4,2); return 'vec3('+([parseInt(r,16)+'.',parseInt(g,16)+'.',parseInt(b,16)+'.'].join(','))+')/255.;'}
const vec3 i_COLOR_ROAD =vec3(58.,61.,68.)/255.; // 3a3d44
const vec3 i_COLOR_BUMPER = vec3(178.,8.,93.)/255.; // b2085d
const vec3 i_COLOR_GRASS = vec3(13.,233.,73.)/255.; // 0d8549
const vec3 i_COLOR_CAR = 1.-vec3(249.,193.,28.)/255.; // f9c11c
const vec3 i_COLOR_FOG = vec3(.8,.9,1);
const vec3 i_COLOR_SKY = .5*vec3(64.,146.,254)/255.;

void m0()
{
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = mix(
            texture2D(u_prevState, vec2( (float(i)+.5)/s_totalStateSize.)),
            texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)),
            u_lerpTime ).xyz;

    initGlobals();

    vec2 uv = (gl_FragCoord.xy - .5*u_resolution)/u_resolution.y;

    vec3 fwdxz = normalize(vec3(g_carForwardDir.x, 0, g_carForwardDir.z));


    vec3 ro, lookAt;
    if( u_modeTitle )
    {
        ro = vec3(10,10,80);
        lookAt = g_carCenterPt + vec3(0,1,0);
    }
    else
    {
        ro = g_carCenterPt + vec3(0,2,0) - 7.*fwdxz;
        lookAt = g_carCenterPt + vec3(0,1,0);
    }

    float zoom = 1.;
    //vec3 ro = vec3(0);
    vec3 f = normalize(lookAt - ro);
    //vec3 r = normalize(cross(-g_carDownDir, f));
    vec3 r = normalize(cross(vec3(0,1,0), f));
    vec3 u = cross(f, r);
    vec3 c = ro + f * zoom;
    vec3 i = c + uv.x * r + uv.y * u;
    vec3 rd = normalize(i - ro);
    
    March m = march( ro, rd );
    
    float sunlight = 0.;
    vec3 SKY = mix(i_COLOR_FOG, i_COLOR_SKY, clamp(2.*dot(rd,vec3(0,1,0)),0.,1.));
    vec3 color = SKY;
    
    if( m.dist >= 0.0 ) {
        vec3 norm = getNorm( m.pos );
        vec3 lightDir = normalize(vec3(2,2,-1));
        sunlight = clamp(dot(lightDir, norm),.1,1.);
        color = m.mat < 1. ? i_COLOR_ROAD : m.mat < 2. ? i_COLOR_BUMPER : m.mat < 3. ? i_COLOR_GRASS : i_COLOR_CAR ;
        color *= 1. + .1*surfFunc(m.pos);
        color *= sunlight;

        float ml = shadowMarch(m.pos, lightDir, .1, 30.);
        color *= .4 + .6*ml;

        float fog = exp( -.02*m.dist );
        color = mix( color, SKY, 1.-fog );
    }


    vec2 uv1 = gl_FragCoord.xy / u_resolution;
    uv1.y = 1. - uv1.y;
    if( uv1.y < .7 )
        uv1.x += .5*uv1.y - .27;
    vec4 canvas = texture2D( u_canvas, uv1 );


    canvas.a = 0.;


    gl_FragColor = vec4( mix(color, canvas.rgb, .5*canvas.a), 1 );
}
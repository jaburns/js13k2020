uniform vec2 u_resolution;
uniform sampler2D u_state;
uniform sampler2D u_prevState;
uniform float u_lerpTime;
uniform bool u_modeState;

vec3 g_state[14];

const float i_EPS = 0.01;
const float i_PRECISION = .8;
const int i_ITERATIONS = 99;

const vec3 i_COLORA = vec3(.8,.4,1);
const vec3 i_COLORC = vec3(.0,.2,.3);

mat2 rot( float t )
{
    return mat2(cos(t), sin(t), -sin(t), cos(t));
}

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdSphere( vec3 p, float r )
{
    return length(p) - r;
}

float map( vec3 p )
{
    float world =
        min(sdBox( (mat4(-0.0802,0,0.9968,0,0,1,0,0,-0.9968,0,-0.0802,0,9.7113,7.7,-0.0714,1)*vec4(p,1)).xyz, vec3(21.003,1.2916,19.435) ),min(sdBox( (mat4(0.7996,0.1725,-0.5753,0,-0.5641,0.5444,-0.6209,0,0.2061,0.8209,0.5325,0,-6.8698,-4.3597,-16.2646,1)*vec4(p,1)).xyz, vec3(5.8863,5.8863,5.8863) ),min(sdBox( (mat4(0.0241,0.7624,0.6466,0,-0.5641,0.5444,-0.6209,0,-0.8254,-0.3498,0.4432,0,10.1649,5.9443,-14.7828,1)*vec4(p,1)).xyz, vec3(5.8863,5.8863,5.8863) ),min(sdBox( (mat4(-0.0752,-0.0279,0.9968,0,-0.3477,0.9376,0,0,-0.9346,-0.3466,-0.0802,0,8.3046,13.2649,0.7672,1)*vec4(p,1)).xyz, vec3(4.6284,4.6283,4.6284) ),min(sdBox( (mat4(0.1063,0.9118,0.3966,0,-0.3907,0.4051,-0.8266,0,-0.9144,-0.0671,0.3993,0,5.9394,-18.1587,-16.0968,1)*vec4(p,1)).xyz, vec3(19.3539,15.3994,4.6284) ),min(sdBox( (mat4(-0.3313,-0.1861,0.925,0,0.3533,0.8846,0.3045,0,-0.8749,0.4277,-0.2273,0,2.1767,8.4828,4.1946,1)*vec4(p,1)).xyz, vec3(9.8223,4.6283,21.5019) ),sdBox( (mat4(-0.0752,-0.0279,0.9968,0,-0.3477,0.9376,0,0,-0.9346,-0.3466,-0.0802,0,16.8634,7.3837,0.757,1)*vec4(p,1)).xyz, vec3(4.6284,4.6283,4.6284) )))))))
    ;

    if( u_modeState )
        return world;

    return min(
        sdSphere( p - ST.wheelPos[0], .5 ),
        min(
            sdSphere( p - ST.wheelPos[1], .5 ),
            min(
                sdSphere( p - ST.wheelPos[2], .5 ),
                min(
                    sdSphere( p - ST.wheelPos[3], .5 ),
                    world ))));
}

struct March
{
    vec3 pos;
    float dist;
    float ao;
};

March march( vec3 ro, vec3 rd )
{
    float dist;
	float totalDist = 0.0;
    
    int j = 0;
    for( int i = 0; i < i_ITERATIONS; ++i )
    {
        j = i;
        dist = map( ro );
        if( dist < i_EPS || totalDist > 200. ) break;
        totalDist += i_PRECISION * dist;
        ro += i_PRECISION * rd * dist;
    }
    
    return March( ro, dist < i_EPS ? totalDist : -1.0, float(j) / 90. );
}

vec3 getNorm(vec3 p)
{
    vec2 e = vec2(0.001, 0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)));
}

void distConstraint( inout vec3 pos0, inout vec3 pos1, float dist )
{
    vec3 iToJ = pos0 - pos1;
    vec3 fixVec = .5 * (dist - length(iToJ)) * normalize( iToJ );
    pos0 += fixVec;
    pos1 -= fixVec;
}

void m1()
{
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)).xyz;

// ----- State update -----

    for( int i = 0; i < 4; ++i )
    {
        vec3 posStep = ST.wheelPos[i] - ST.wheelLastPos[i] - vec3( 0, .0109, 0 ); // 9.81/30/30
        ST.wheelLastPos[i] = ST.wheelPos[i];
        ST.wheelPos[i] += posStep;

        float dist = map( ST.wheelPos[i] );
        vec3 normal = getNorm( ST.wheelPos[i] );

        if( dist < .5 )
        {
            ST.wheelPos[i] += (.5-dist)*normal;

            vec3 vel = ST.wheelPos[i] - ST.wheelLastPos[i];
            vel = reflect( vel, normal );
            ST.wheelLastPos[i] = ST.wheelPos[i] - vel;
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

void m0()
{
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = mix(
            texture2D(u_prevState, vec2( (float(i)+.5)/s_totalStateSize.)),
            texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)),
            u_lerpTime ).xyz;

    vec2 uv = (gl_FragCoord.xy - .5*u_resolution)/u_resolution.y;

    vec3 carForwardDir = normalize(ST.wheelPos[2] - ST.wheelPos[1]);
    vec3 carCenterPt = (ST.wheelPos[0] + ST.wheelPos[1] + ST.wheelPos[2] + ST.wheelPos[3])/4.;
    vec3 carForwardXZ = normalize(vec3(carForwardDir.x, 0, carForwardDir.z));

    float zoom = 1.;
    vec3 ro = (carCenterPt - 7.*carForwardXZ) + vec3(0,3,0);
    vec3 lookAt = carCenterPt + vec3(0,2,0);
    vec3 f = normalize(lookAt - ro);
    vec3 r = normalize(cross(vec3(0,1,0), f));
    vec3 u = cross(f, r);
    vec3 c = ro + f * zoom;
    vec3 i = c + uv.x * r + uv.y * u;
    vec3 rd = normalize(i - ro);
    
    March m = march( ro, rd );
    
    float lightness = 0.;
    vec3 color = i_COLORC;
    
    if( m.dist >= 0.0 ) {
        float fog = exp( -.02*m.dist );
        vec3 norm = getNorm( m.pos );
        lightness = fog * (1. - m.ao);
        lightness *= 1.2*clamp(dot(normalize(vec3(0,2,-1)), norm),0.2,1.);
        color = i_COLORA;
        color = mix( i_COLORC, color, lightness );        
    }

    gl_FragColor = vec4(color,1);
}
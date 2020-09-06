uniform sampler2D u_state;
uniform sampler2D u_prevState;
uniform float u_time;
uniform float u_lerpTime;
uniform bool u_modeState;
uniform int u_menuMode; // 0 -> in-game, 1 -> in-menu, 2 -> boot screen
uniform vec4 u_inputs;

vec3 g_state[s_totalStateSize];
vec3 g_carCenterPt;
vec3 g_carLastCenterPt;
vec3 g_carForwardDir;
vec3 g_carUpDir;
vec3 g_steerForwardDir;
mat3 g_wheelRot;
mat3 g_steerRot;

#pragma INCLUDE_WORLD_SDF

mat3 transpose( mat3 m )
{
    return mat3(
        m[0][0], m[1][0], m[2][0],
        m[0][1], m[1][1], m[2][1],
        m[0][2], m[1][2], m[2][2]
    );
}

float sdCappedCylinder1( vec3 p, float h, float r )
{
    vec2 d = abs(vec2(length(p.yz),p.x)) - vec2(h,r);
    return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - .1;
}
float sdCapsule1( vec3 p, vec3 a, vec3 b, float r )
{
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
}
float sdUnevenCapsule( vec2 p, float r1, float r2, float h )
{
    p.x = abs(p.x);
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(p,vec2(-b,a));
    if( k < 0.0 ) return length(p) - r1;
    if( k > a*h ) return length(p-vec2(0.0,h)) - r2;
    return dot(p, vec2(a,b) ) - r1;
}
float sdUnevenCapsule3d( in vec3 p, float r1, float r2, float l, float h )
{
    float d = sdUnevenCapsule(p.xz, r1, r2, l);
    vec2 w = vec2( d, abs(p.y) - h );
    return min(max(w.x,w.y),0.0) + length(max(w,0.0));
}
float sdEllipsoid( vec3 p, vec3 r )
{
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0*(k0-1.0)/k1;
}
vec2 sdWheel( vec3 p, float theta )
{
    vec2 p1 = rot( theta ) * p.yz;
    float atn = abs(atan(p1.x/p1.y));
    float material = length(p.yz) < .3 ? i_MAT_CAR0 : atn < .125*3.14159 || atn > .375*3.14159 ? i_MAT_CAR1 : i_MAT_CAR2;
    float d = sdCappedCylinder1(p,.3,.1);
    return vec2( d, material );
}
vec2 sdBody( vec3 p )
{
    p.z *= -1.;
    vec2 d = vec2( p.z < 1.2 ? sdEllipsoid( p-vec3(0,0,-.05), vec3(.3, .25, 1.5)) : 1000., i_MAT_CAR3 );
    d = min2(d, vec2(sdEllipsoid(p-vec3(0,0,.4), vec3(.3, .4, .6)), i_MAT_CAR4 ));
    d = min2(d, vec2(sdUnevenCapsule3d( p-vec3(0,0,-.25), .35, .55, 1., .15 ), i_MAT_CAR5 ));
    d = min2(d, vec2(sdBox(p-vec3(0,0,1.), vec3(.45,.15,.25)), i_MAT_CAR5 ));
    return d;
}

vec2 map( vec3 p )
{
    vec2 world = Xmap( p );

    world = min2( world, sdCheckpoint( p, Xc0, Xf0, ST.goalStateA.x ) );
    world = min2( world, sdCheckpoint( p, Xc1, Xf1, ST.goalStateA.y ) );
    world = min2( world, sdCheckpoint( p, Xc2, Xf2, ST.goalStateA.z ) );
    world = min2( world, sdCheckpoint( p, Xc3, Xf3, ST.goalStateB.x ) );

    if( u_modeState )
    {
        world = min2( world, vec2(p.y,1) );
        return world;
    }

    world = min2( world, sdBody(g_wheelRot*(p - g_carCenterPt)));
    world = min2( world, sdWheel( g_wheelRot*(p - ST.wheelPos[0]), ST.wheelRotation[0].x));
    world = min2( world, sdWheel( g_wheelRot*(p - ST.wheelPos[1]), ST.wheelRotation[1].x));
    world = min2( world, sdWheel( g_steerRot*(p - ST.wheelPos[2]), ST.wheelRotation[2].x));
    world = min2( world, sdWheel( g_steerRot*(p - ST.wheelPos[3]), ST.wheelRotation[3].x));
    
    world = min2(world, vec2(  sdCapsule1( p, ST.wheelPos[2], ST.wheelPos[3], .08 ), i_MAT_CAR6 ));
    world = min2(world, vec2(  sdCapsule1( p, ST.wheelPos[0], ST.wheelPos[1], .08 ), i_MAT_CAR6 ));

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

void initGlobals()
{
    vec3 carDownDir = normalize(
        normalize(cross( ST.wheelPos[0] - ST.wheelPos[3], ST.wheelPos[2] - ST.wheelPos[3] )) -
        normalize(cross( ST.wheelPos[0] - ST.wheelPos[1], ST.wheelPos[2] - ST.wheelPos[1] ))
    );
    if( carDownDir.y > 0. ) carDownDir *= -1.;

    vec3 nonOrthoFwdDir = 
        normalize( ST.wheelPos[2] - ST.wheelPos[1] ) +
        normalize( ST.wheelPos[3] - ST.wheelPos[0] );

    vec3 carRightDir = normalize( cross( carDownDir, nonOrthoFwdDir ));

    g_carForwardDir = cross( carRightDir, carDownDir );

    g_carCenterPt = ( ST.wheelPos[0] + ST.wheelPos[1] + ST.wheelPos[2] + ST.wheelPos[3] ) / 4.;

    mat3 wheelRotFwd = mat3( carRightDir, carDownDir, g_carForwardDir );
    g_wheelRot = transpose( wheelRotFwd );

    g_steerForwardDir = vec3( 0, 0, 1 );
    g_steerForwardDir.xz *= rot( ST.carState.x );
    g_steerForwardDir = wheelRotFwd * g_steerForwardDir;

    g_steerRot = transpose( mat3( cross( carDownDir, g_steerForwardDir ), carDownDir, g_steerForwardDir ));

// TODO dont have both
    g_carUpDir = -carDownDir;
}

#ifdef XA

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

void main()
{
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)).xyz;

    initGlobals();

// ----- State update -----

    const float i_STEER_RATE = .03;

    vec3 carLastCenterPt = ( ST.wheelLastPos[0] + ST.wheelLastPos[1] + ST.wheelLastPos[2] + ST.wheelLastPos[3] ) / 4.;

    vec3 carVel = g_carCenterPt - carLastCenterPt;
    ST.carState.y = length( carVel );
    float maxSteer = mix( .15, .02, .5*clamp( ST.carState.y, 0., 2. ));

    if( u_menuMode > 0 )
        ST.carState.x = 0.;
    else if( u_inputs.z > 0. )
        ST.carState.x += min( i_STEER_RATE, maxSteer - ST.carState.x );
    else if( u_inputs.w > 0. )
        ST.carState.x -= min( i_STEER_RATE, maxSteer + ST.carState.x );
    else
        ST.carState.x -= sign( ST.carState.x ) * min( abs( ST.carState.x ), i_STEER_RATE );

    // Update checkpoint states
    vec3 checkFwd = transpose(quat( Xf0 )) * vec3( 0, 0, 1 );
    if( length( g_carCenterPt - Xc0 ) < 5. && sign( dot( g_carCenterPt - Xc0, checkFwd )) != sign( dot( carLastCenterPt - Xc0, checkFwd )))
        ST.goalStateA.x = 1.;
    checkFwd = transpose(quat( Xf1 )) * vec3( 0, 0, 1 );
    if( length( g_carCenterPt - Xc1 ) < 5. && sign( dot( g_carCenterPt - Xc1, checkFwd )) != sign( dot( carLastCenterPt - Xc1, checkFwd )))
        ST.goalStateA.y = 1.;
    checkFwd = transpose(quat( Xf2 )) * vec3( 0, 0, 1 );
    if( length( g_carCenterPt - Xc2 ) < 5. && sign( dot( g_carCenterPt - Xc2, checkFwd )) != sign( dot( carLastCenterPt - Xc2, checkFwd )))
        ST.goalStateA.z = 1.;
    checkFwd = transpose(quat( Xf3 )) * vec3( 0, 0, 1 );
    if( length( g_carCenterPt - Xc3 ) < 5. && sign( dot( g_carCenterPt - Xc3, checkFwd )) != sign( dot( carLastCenterPt - Xc3, checkFwd )))
        ST.goalStateB.x = 1.;

    for( int i = 0; i < 4; ++i )
    {
        vec3 posStep = ST.wheelPos[i] - ST.wheelLastPos[i]  + (ST.wheelForceCache[i] - vec3(0,s_gravity,0)) / s_sqrTicksPerSecond.;
        ST.wheelLastPos[i] = ST.wheelPos[i];
        ST.wheelPos[i] += posStep;
        ST.wheelForceCache[i] = vec3( 0 );

        float dist = map( ST.wheelPos[i] ).x;
        vec3 normal = getNorm( ST.wheelPos[i] );

        if( dist < s_wheelRadius )
        {
            ST.wheelPos[i] += (s_wheelRadius-dist)*normal;

            float lateralFriction = .1;
            if( u_menuMode == 0 && u_inputs.y < 0. ) lateralFriction = i < 2 ? .8 : .6;

            vec3 vel = ST.wheelPos[i] - ST.wheelLastPos[i];
            vel = lossyReflect( vel, normal, i < 2 ? g_carForwardDir : g_steerForwardDir, .2, .995, lateralFriction );
            ST.wheelLastPos[i] = ST.wheelPos[i] - vel;

            if( u_menuMode == 0 && ( u_inputs.x > 0. || u_inputs.y > 0. ))
            {
                vec3 xs = cross( normal, i < 2 ? g_carForwardDir : g_steerForwardDir );
                vec3 groundedFwd = normalize( cross( xs, normal ));
                ST.wheelForceCache[i] = 10. * groundedFwd * ( u_inputs.x > 0. ? 1. : -.5 );
            }

            ST.wheelRotation[i].y = ST.carState.y * s_wheelRadius * sign(dot(carVel, g_carForwardDir));
            ST.wheelRotation[i].z = min( ST.wheelRotation[i].z + 1., 3. );
        }
        else
            ST.wheelRotation[i].z = max( ST.wheelRotation[i].z - 1., 0. );

        if( u_menuMode != 0 || !( u_inputs.y < 0. && i < 2 ))
            ST.wheelRotation[i].x += ST.wheelRotation[i].y;
    }

    distConstraint( ST.wheelPos[0], ST.wheelPos[1], s_wheelBaseWidth );
    distConstraint( ST.wheelPos[0], ST.wheelPos[2], sqrt(s_wheelBaseWidth*s_wheelBaseWidth + s_wheelBaseLength.*s_wheelBaseLength.) );
    distConstraint( ST.wheelPos[0], ST.wheelPos[3], s_wheelBaseLength. );
    distConstraint( ST.wheelPos[1], ST.wheelPos[2], s_wheelBaseLength. );
    distConstraint( ST.wheelPos[1], ST.wheelPos[3], sqrt(s_wheelBaseWidth*s_wheelBaseWidth + s_wheelBaseLength.*s_wheelBaseLength.) );
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

#else

void main()
{
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = mix(
            texture2D(u_prevState, vec2( (float(i)+.5)/s_totalStateSize.)),
            texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)),
            u_lerpTime ).xyz;

    initGlobals();

    vec2 uv = (gl_FragCoord.xy - .5*vec2(s_renderWidth., s_renderHeight.))/s_renderHeight.;

    vec3 ro, lookDir, camUp = vec3(0,1,0);
    if( u_menuMode == 2 )
    {
        ro = vec3(10,10,80);
        lookDir = g_carCenterPt + vec3(0,1,0);
    }
    else
    {
        // camUp = g_carUpDir;
        // ro = g_carCenterPt + g_carUpDir*.5 - g_carForwardDir*.5;
        // lookDir = ro + g_carForwardDir;
        vec3 fwdxz = normalize(vec3(g_carForwardDir.x, 0, g_carForwardDir.z));
        ro = g_carCenterPt + vec3(0,2,0) - 7.*fwdxz;
        lookDir = g_carCenterPt + vec3(0,1,0);
    }

    vec3 roo = ro;
    vec3 f = normalize(lookDir - ro);
    vec3 r = normalize(cross(camUp, f));
    vec3 u = cross(f, r);
    vec3 c = ro + f;
    vec3 i = c + uv.x * r + uv.y * u;
    vec3 rd = normalize(i - ro);

    vec2 dist;
    float totalDist = 0.0, distStep;

    const float i_EPS = 0.01;
    for( int i = 0; i < 100; ++i )
    {
        dist = map( ro );
        if( dist.x < i_EPS || totalDist >= 200. || ro.y < 0. ) break;
        distStep = dist.x; // distStep = max( .1, dist.x ); // TODO Make better use of min march distance, if dist ends up negative lerp to how far through an assumed-flat surface
        totalDist += distStep;
        ro += rd * distStep;
    }

    vec3 normal = vec3( 0 ) ;
    float material = 0.;

    float ph = -roo.y / rd.y;
    if(  rd.y < 0. && (  totalDist >= 200. || ph > 0.0 && ph < totalDist )) {
        ro = roo + ph*rd;
        normal = vec3( 0, 1, 0 );
        material = 1.;
    }
    else if( dist.x < i_EPS )
    {
        normal = getNorm( ro );
        material = dist.y;
    }
    else if( rd.y < 0. )
    {
        ro = roo + ph*rd;
        normal = vec3( 0, 1, 0 );
        material = 1.;
    }

    if( material == 1. )
    {
        vec3 rep = floor(ro / 4. + .01);
        material += .5 * mod(rep.x + rep.y + rep.z, 2.);
        float lightness = exp( -.01 * length(ro - roo) );
        material += .4 * lightness;
    }

    if( material == 0. )
    {
        float sunDot = dot( rd, normalize( vec3( -.5, .3, 1 )));
        if( sunDot > .97 ) {
            material = rd.y;
        } else {
            material = .5 + .5*rd.y;
        }
    }

    if( material > 1. )
    {
        rd = normalize( vec3( -.5, .3, 1 ));
        float t = .1;
        for( int i = 0; i < 50; ++i )
        {
            if( t >= 30. ) break;
            float d = map( ro + rd*t ).x;
            if( d < 0.001 ) {
                material *= -1.;
                break;
            }
            t += max( .1, d );
        }
    }

    gl_FragColor = vec4( normal, material );
}

#endif

uniform sampler2D u_state;
uniform sampler2D u_prevState;
uniform sampler2D u_ghost;
uniform sampler2D u_prevGhost;
uniform float u_time;
uniform float u_lerpTime;
uniform bool u_modeState;
uniform bool u_enableGhost;
uniform bool u_replayMode;
uniform int u_menuMode; // 0 -> in-game, 1 -> in-menu, 2 -> boot screen
uniform vec4 u_inputs;

vec3 g_state[s_totalStateSize];

vec3 g_carCenterPt;
vec3 g_ghostCenterPt;

mat3 g_wheelRot;
mat3 g_steerRot;

mat3 g_ghostWheelRot;
mat3 g_ghostSteerRot;

vec4 g_ghostWheel0;
vec4 g_ghostWheel1;
vec4 g_ghostWheel2;
vec4 g_ghostWheel3;

vec4 g_traceBits;

#pragma INCLUDE_WORLD_SDF

// ==========================================================================================================

mat3 transpose( mat3 m )
{
    return mat3(
        m[0][0], m[1][0], m[2][0],
        m[0][1], m[1][1], m[2][1],
        m[0][2], m[1][2], m[2][2]
    );
}

// ==========================================================================================================
//  Car model

float sdAxle( vec3 p, vec3 a, vec3 b )
{
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0., 1. );
    return length( pa - ba*h ) - .08;
}
float sdEllipsoid( vec3 p, vec3 r )
{
    float k0 = length(p/r);
    return k0*(k0-1.) / length(p/(r*r));
}
vec2 sdWheel( float subM, vec3 p, float theta )
{
    vec2 p1 = rot( theta ) * p.yz;
    vec2 d = abs(vec2(length(p.yz),p.x)) - vec2(.3,.1);
    float atn = abs(atan(p1.x/p1.y));
    float material = length(p.yz) < .3 ? i_MAT_CAR0 : atn < .125*3.14159 || atn > .375*3.14159 ? i_MAT_CAR1 : i_MAT_CAR2;
    return vec2( min(max(d.x,d.y),0.) + length(max(d,0.)) - .1, material - subM );
}
vec2 sdBody( float subM, vec3 p )
{
    p.z *= -1.;
    vec2 d = vec2( p.z < 1.2 ? sdEllipsoid( p-vec3(0,0,-.05), vec3(.3, .25, 1.5)) : 1000., i_MAT_CAR3 );
    d = min2(d, vec2(sdEllipsoid(p-vec3(0,0,.4), vec3(.3, .4, .6)), i_MAT_CAR4 ));

    vec3 p0 = p - vec3(0,0,-.25);
    vec2 p1 = vec2(abs(p0.x), p0.z);
    float k = dot(p1,vec2(.2,.9798));
    vec2 w = vec2( k < 0.
        ? length(p1) - .35
        : k > .9798 
            ? length(p1-vec2(0,1)) - .55
            : dot(p1, vec2(.9798,-.2)) - .35,
        abs(p0.y) - .15
    );
    d = min2(d, vec2(min(max(w.x,w.y),0.) + length(max(w,0.)), i_MAT_CAR5 ));

    d = min2(d, vec2(sdBox(p-vec3(0,0,1), vec3(.45,.15,.25)), i_MAT_CAR5 ));
    d.y -= subM;
    return d;
}

// ==========================================================================================================
//  World signed distance field

vec2 map( vec3 p )
{
    vec2 world = Xm( p );

    if( u_modeState )
    {
        world = min2( world, vec2(p.y,1) );
        return world;
    }

    if( mod( g_traceBits.x / i_BIT2, 2. ) >= 1. )
        world = min2( world, sdCheckpoint( p, Xc0, Xf0, ST.goalStateA.x ) );
    if( mod( g_traceBits.x / i_BIT3, 2. ) >= 1. )
        world = min2( world, sdCheckpoint( p, Xc1, Xf1, ST.goalStateA.y ) );
    if( mod( g_traceBits.x / i_BIT4, 2. ) >= 1. )
        world = min2( world, sdCheckpoint( p, Xc2, Xf2, ST.goalStateA.z ) );
    if( mod( g_traceBits.x / i_BIT5, 2. ) >= 1. )
        world = min2( world, sdCheckpoint( p, Xc3, Xf3, ST.goalStateB.x ) );

    if( !u_replayMode && mod( g_traceBits.x / i_BIT0, 2. ) >= 1. )
    {
        world = min2( world, sdBody ( 0., g_wheelRot*(p - g_carCenterPt)));
        world = min2( world, sdWheel( 0., g_wheelRot*(p - ST.wheelPos[0]), ST.wheelRotation[0].x));
        world = min2( world, sdWheel( 0., g_wheelRot*(p - ST.wheelPos[1]), ST.wheelRotation[1].x));
        world = min2( world, sdWheel( 0., g_steerRot*(p - ST.wheelPos[2]), ST.wheelRotation[2].x));
        world = min2( world, sdWheel( 0., g_steerRot*(p - ST.wheelPos[3]), ST.wheelRotation[3].x));
        world = min2( world, vec2( sdAxle( p, ST.wheelPos[2], ST.wheelPos[3] ), i_MAT_CAR6 ));
        world = min2( world, vec2( sdAxle( p, ST.wheelPos[0], ST.wheelPos[1] ), i_MAT_CAR6 ));
    }

    if( u_enableGhost && mod( g_traceBits.x / i_BIT1, 2. ) >= 1. )
    {
        world = min2( world, sdBody ( 5., g_ghostWheelRot*(p - g_ghostCenterPt) ));
        world = min2( world, sdWheel( 5., g_ghostWheelRot*(p - g_ghostWheel0.xyz), g_ghostWheel1.w ));
        world = min2( world, sdWheel( 5., g_ghostWheelRot*(p - g_ghostWheel1.xyz), g_ghostWheel1.w ));
        world = min2( world, sdWheel( 5., g_ghostSteerRot*(p - g_ghostWheel2.xyz), g_ghostWheel2.w ));
        world = min2( world, sdWheel( 5., g_ghostSteerRot*(p - g_ghostWheel3.xyz), g_ghostWheel3.w ));
        world = min2( world, vec2( sdAxle( p, g_ghostWheel2.xyz, g_ghostWheel3.xyz ), i_MAT_CAR6 - 5. ));
        world = min2( world, vec2( sdAxle( p, g_ghostWheel0.xyz, g_ghostWheel1.xyz ), i_MAT_CAR6 - 5. ));
    }

    return world;
}

vec3 getNorm(vec3 p)
{
    vec2 e = vec2(.001, 0);
    return normalize(vec3(
        map(p + e.xyy).x - map(p - e.xyy).x,
        map(p + e.yxy).x - map(p - e.yxy).x,
        map(p + e.yyx).x - map(p - e.yyx).x));
}

// ==========================================================================================================
//  Helper function for calculating car orientation from wheel positions and steering angle

void getCarOrientation(
    vec3 w0, vec3 w1, vec3 w2, vec3 w3, float steer, int updateFlipped, inout float flipped,
    out vec3 downDir, out vec3 fwdDir, out vec3 steerFwdDir, out vec3 centerPt, out mat3 wheelRot, out mat3 steerRot
)
{
    centerPt = .25 * (w0 + w1 + w2 + w3);

    downDir = normalize( normalize(cross(w0-w3, w2-w3)) - normalize(cross(w0-w1, w2-w1)) );
    vec3 nonOrthoFwdDir = normalize( w2-w1 ) + normalize( w3-w0 );

    if( updateFlipped == 1 && ( length( centerPt - Xp0.xyz ) > Xp0.w || map( centerPt - flipped*downDir*.6 ).x < 0. ))
        updateFlipped = 2;

    if( updateFlipped == 2 )
        flipped = downDir.y > 0. ? -1. : 1.;

    downDir *= flipped;

    vec3 carRightDir = normalize( cross( downDir, nonOrthoFwdDir ));
    fwdDir = cross( carRightDir, downDir );

    mat3 wheelRotFwd = mat3( carRightDir, downDir, fwdDir );
    wheelRot = transpose( wheelRotFwd );

    steerFwdDir = vec3( 0, 0, 1 );
    steerFwdDir.xz *= rot( steer );
    steerFwdDir = wheelRotFwd * steerFwdDir;

    steerRot = transpose( mat3( cross( downDir, steerFwdDir ), downDir, steerFwdDir ));
}

#ifdef XA
// ==========================================================================================================
//  State update shader

void distConstraint( inout vec3 pos0, inout vec3 pos1, float dist )
{
    // Moves two points closer or further to their average such that their distance becomes `dist`
    vec3 iToJ = pos0 - pos1;
    vec3 fixVec = .5 * (dist - length(iToJ)) * normalize( iToJ );
    pos0 += fixVec;
    pos1 -= fixVec;
}

void main()
{
    // Set all the bounding box trace bits for sampling the world distance field.
    // It's not worth trying to optimize the map sampling function for the state update.
    g_traceBits = vec4(i_BITS_ALL);

    // Load game state from the texture strip in to the global array.
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)).xyz;

if( !u_replayMode ) {

    // Calculate and keep the car orientation properties we care about.
    vec3 carCenterPt;
    vec3 carForwardDir;
    vec3 carSteerForwardDir;
    {
        mat3 carWheelRot;
        mat3 carSteerRot;
        vec3 carDownDir;
        getCarOrientation(
            ST.wheelPos[0], ST.wheelPos[1], ST.wheelPos[2], ST.wheelPos[3], ST.carState.x,
            1, ST.carState.z,
            carDownDir,
            carForwardDir,
            carSteerForwardDir,
            carCenterPt,
            carWheelRot,
            carSteerRot
        );
    }

    // Update car speed
    vec3 carLastCenterPt = ( ST.wheelLastPos[0] + ST.wheelLastPos[1] + ST.wheelLastPos[2] + ST.wheelLastPos[3] ) / 4.;
    vec3 carVel = carCenterPt - carLastCenterPt;
    ST.carState.y = length( carVel );
    float velSign = sign(dot(carVel, carForwardDir));

    float drivingWheels = 0.;

    // Update steering angle
    float steerRate = mix( .03, .01, .5*clamp( ST.carState.y, 0., 2. ));
    float maxSteer = mix( .15, .01, .5*clamp( ST.carState.y, 0., 2. ));
    if( u_menuMode > 0 )
        ST.carState.x = 0.;
    else if( u_inputs.z > 0. )
        ST.carState.x += min( steerRate, maxSteer - ST.carState.x );
    else if( u_inputs.w > 0. )
        ST.carState.x -= min( steerRate, maxSteer + ST.carState.x );
    else
        ST.carState.x = 0.; // sign( ST.carState.x ) * min( abs( ST.carState.x ), steerRate );

    // Update checkpoint collected states
    if( length( carCenterPt - Xc0 ) < 5. && ST.goalStateA.x < 2. ) {
        float newSign = sign( dot( carCenterPt - Xc0, transpose(quat( Xf0 )) * vec3( 0, 0, 1 )));
        ST.goalStateA.x = newSign != ST.goalStateA.x ? 2. : newSign;
    }
    if( length( carCenterPt - Xc1 ) < 5. && ST.goalStateA.y < 2. ) {
        float newSign = sign( dot( carCenterPt - Xc1, transpose(quat( Xf1 )) * vec3( 0, 0, 1 )));
        ST.goalStateA.y = newSign != ST.goalStateA.y ? 2. : newSign;
    }
    if( length( carCenterPt - Xc2 ) < 5. && ST.goalStateA.z < 2. ) {
        float newSign = sign( dot( carCenterPt - Xc2, transpose(quat( Xf2 )) * vec3( 0, 0, 1 )));
        ST.goalStateA.z = newSign != ST.goalStateA.z ? 2. : newSign;
    }
    if( length( carCenterPt - Xc3 ) < 5. && ST.goalStateB.x < 2. ) {
        float newSign = sign( dot( carCenterPt - Xc3, transpose(quat( Xf3 )) * vec3( 0, 0, 1 )));
        ST.goalStateB.x = newSign != ST.goalStateB.x ? 2. : newSign;
    }

    // Step the simulation for each of the individual wheels
    for( int i = 0; i < 4; ++i )
    {
        // Verlet integrate the wheel positions, applying force
        vec3 posStep = ST.wheelPos[i] - ST.wheelLastPos[i]  + (ST.wheelForceCache[i] - vec3(0,s_gravity,0)) / s_sqrTicksPerSecond.;
        ST.wheelLastPos[i] = ST.wheelPos[i];
        ST.wheelPos[i] += posStep;
        ST.wheelForceCache[i] = vec3( 0 );

        // If the distance function sampled at the center of the wheel is less than the wheel radius, we're in the ground
        vec2 distMat = map( ST.wheelPos[i] );
        vec3 normal = getNorm( ST.wheelLastPos[i] ); // Using the normal from last tick prevents the wheels from wrapping around sharp fall-offs
        if( distMat.x < s_wheelRadius )
        {
            if( distMat.y < 2. )
                ST.goalStateB.y = 1.;

            // Restore the wheel to the surface
            ST.wheelPos[i] += (s_wheelRadius-distMat.x)*normal;

            // Calculate lateral friction based on whether the drift button is pressed
            float lateralFriction = .1;
            if( u_menuMode == 0 && u_inputs.y < 0. ) lateralFriction = i < 2 ? .8 : .6;

            // Apply friction and bounce to the velocity of the wheel by modifying the previous position
            vec3 vel = ST.wheelPos[i] - ST.wheelLastPos[i];
            vec3 tan_v = normalize( cross( normal, i < 2 ? carForwardDir : carSteerForwardDir ));
            vec3 tan_u = cross( normal, tan_v );
            float i_v_n = .2 * dot( vel, normal );
            float i_v_u = .995 * dot( vel, tan_u );
            float i_v_v = lateralFriction * dot( vel, tan_v );
            ST.wheelLastPos[i] = ST.wheelPos[i] + i_v_n*normal - i_v_u*tan_u - i_v_v*tan_v;

            // Add the driving force to the wheels parallel with the ground if the pedal is pressed
            if( i > 1 && u_menuMode == 0 && ( u_inputs.x > 0. || u_inputs.y > 0. ))
            {
                drivingWheels++;
                float i_accel = (distMat.y < 6. || distMat.y >= 8. ? 20. : distMat.y < 7. ? 40. : 0.) + max( 0., 10. - 20.*ST.carState.y );
                vec3 i_groundedFwd = normalize( cross( cross( normal, carSteerForwardDir ), normal ));
                ST.wheelForceCache[i] = i_accel * i_groundedFwd * ( u_inputs.x > 0. ? 1. : velSign > 0. ? -1.5 : -.5 );
            }

            // Update the wheel angular velocity to match the speed of the wheel relative to the ground
            ST.wheelRotation[i].y = ST.carState.y * s_wheelRadius * velSign;
            ST.wheelRotation[i].z = min( ST.wheelRotation[i].z + 1., 3. );
        }
        else  // Unset the "wheel is grounded" state
            ST.wheelRotation[i].z = max( ST.wheelRotation[i].z - 1., 0. );

        // Integrate the wheel angular velocity in to its rotation
        if( u_menuMode != 0 || !( u_inputs.y < 0. && i < 2 ))
            ST.wheelRotation[i].x += ST.wheelRotation[i].y;
    }

    if( drivingWheels < 2. )
        for( int i = 0; i < 4; ++i )
            ST.wheelForceCache[i] = vec3(0);

    // Apply distance constraints to every pair of wheels
    distConstraint( ST.wheelPos[0], ST.wheelPos[1], s_wheelBaseWidth );
    distConstraint( ST.wheelPos[0], ST.wheelPos[2], sqrt(s_wheelBaseWidth*s_wheelBaseWidth + s_wheelBaseLength.*s_wheelBaseLength.) );
    distConstraint( ST.wheelPos[0], ST.wheelPos[3], s_wheelBaseLength. );
    distConstraint( ST.wheelPos[1], ST.wheelPos[2], s_wheelBaseLength. );
    distConstraint( ST.wheelPos[1], ST.wheelPos[3], sqrt(s_wheelBaseWidth*s_wheelBaseWidth + s_wheelBaseLength.*s_wheelBaseLength.) );
    distConstraint( ST.wheelPos[2], ST.wheelPos[3], s_wheelBaseWidth );
   
}//if( !u_replayMode )

    // Color the outgoing pixel with the new state variables depending on which state pixel we're drawing
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
// ==========================================================================================================
//  Main (only) G buffer render shader

float traceObjects( vec3 ro, vec3 rd )
{
    float traceDist = 10000.;
    vec3 carBoundsMin = min( ST.wheelPos[0], min( ST.wheelPos[1], min( ST.wheelPos[2], ST.wheelPos[3] ))) - 2.*s_wheelRadius;
    vec3 carBoundsMax = max( ST.wheelPos[0], max( ST.wheelPos[1], max( ST.wheelPos[2], ST.wheelPos[3] ))) + 2.*s_wheelRadius;
    vec3 carBoundsSize = .5 * (carBoundsMax - carBoundsMin);

    traceBox(
        ro, rd, traceDist, g_traceBits.x, i_BIT0, 0., 0., 0., 1.,
        g_carCenterPt.x, g_carCenterPt.y, g_carCenterPt.z - .5*carBoundsSize.z, carBoundsSize.x, carBoundsSize.y, carBoundsSize.z
    );

    if( u_enableGhost && ( u_replayMode || length( g_ghostCenterPt - g_carCenterPt ) > .1 ))
    {
        carBoundsMin = min( g_ghostWheel0.xyz, min( g_ghostWheel1.xyz, min( g_ghostWheel2.xyz, g_ghostWheel3.xyz ))) - 2.*s_wheelRadius;
        carBoundsMax = max( g_ghostWheel0.xyz, max( g_ghostWheel1.xyz, max( g_ghostWheel2.xyz, g_ghostWheel3.xyz ))) + 2.*s_wheelRadius;
        carBoundsSize = .5 * (carBoundsMax - carBoundsMin);

        traceBox(
            ro, rd, traceDist, g_traceBits.x, i_BIT1, 0., 0., 0., 1.,
            g_ghostCenterPt.x, g_ghostCenterPt.y, g_ghostCenterPt.z - .5*carBoundsSize.z, carBoundsSize.x, carBoundsSize.y, carBoundsSize.z
        );
    }

    traceBox( ro, rd, traceDist, g_traceBits.x, i_BIT2, Xf0.x, Xf0.y, Xf0.z, Xf0.w, Xc0.x, Xc0.y, Xc0.z, 5.,5.,.5 );
    traceBox( ro, rd, traceDist, g_traceBits.x, i_BIT3, Xf1.x, Xf1.y, Xf1.z, Xf1.w, Xc1.x, Xc1.y, Xc1.z, 5.,5.,.5 );
    traceBox( ro, rd, traceDist, g_traceBits.x, i_BIT4, Xf2.x, Xf2.y, Xf2.z, Xf2.w, Xc2.x, Xc2.y, Xc2.z, 5.,5.,.5 );
    traceBox( ro, rd, traceDist, g_traceBits.x, i_BIT5, Xf3.x, Xf3.y, Xf3.z, Xf3.w, Xc3.x, Xc3.y, Xc3.z, 5.,5.,.5 );

    return traceDist;
}

void main()
{
    for( int i = 0; i < s_totalStateSize; ++i )
        g_state[i] = mix(
            texture2D(u_prevState, vec2( (float(i)+.5)/s_totalStateSize.)),
            texture2D(u_state, vec2( (float(i)+.5)/s_totalStateSize.)),
            u_lerpTime ).xyz;

    float flipped = ST.carState.z > 0. ? 1. : -1.; // undo inter-tick lerping on this value
    vec3 carDownDir;
    vec3 carForwardDir;
    vec3 carSteerForwardDir;
    getCarOrientation(
        ST.wheelPos[0], ST.wheelPos[1], ST.wheelPos[2], ST.wheelPos[3], ST.carState.x,
        0, flipped,
        carDownDir,
        carForwardDir,
        carSteerForwardDir,
        g_carCenterPt,
        g_wheelRot,
        g_steerRot
    );

    vec3 ro, lookDir, camUp = vec3(0,1,0);
    if( u_menuMode == 2 )
    {
        ro = vec3(10,10,80);
        lookDir = g_carCenterPt + vec3(0,1,0);
    }
    else if( length( g_carCenterPt - Xp0.xyz ) < Xp0.w )
    {
        camUp = -carDownDir;
        ro = g_carCenterPt - carDownDir*.6 - carForwardDir*.4;
        lookDir = ro + carForwardDir;
    }
    else
    {
        ro = g_carCenterPt + vec3(0,2,0) - 7.*normalize(vec3(carForwardDir.x, 0, carForwardDir.z));
        lookDir = g_carCenterPt + vec3(0,1,0);
    }

    if( u_enableGhost )
    {
        g_ghostWheel0 = mix( texture2D( u_prevGhost, vec2(.125,.5) ), texture2D( u_ghost, vec2(.125,.5) ), u_lerpTime );
        g_ghostWheel1 = mix( texture2D( u_prevGhost, vec2(.375,.5) ), texture2D( u_ghost, vec2(.375,.5) ), u_lerpTime );
        g_ghostWheel2 = mix( texture2D( u_prevGhost, vec2(.625,.5) ), texture2D( u_ghost, vec2(.625,.5) ), u_lerpTime );
        g_ghostWheel3 = mix( texture2D( u_prevGhost, vec2(.875,.5) ), texture2D( u_ghost, vec2(.875,.5) ), u_lerpTime );

        vec3 ghostDownDir;
        vec3 ghostForwardDir;
        vec3 ghostSteerForwardDir;
        float ghostFlipped;
        getCarOrientation(
            g_ghostWheel0.xyz, g_ghostWheel1.xyz, g_ghostWheel2.xyz, g_ghostWheel3.xyz, 0.,
            2, ghostFlipped,
            ghostDownDir,
            ghostForwardDir,
            ghostSteerForwardDir,
            g_ghostCenterPt,
            g_ghostWheelRot,
            g_ghostSteerRot
        );

        if( u_replayMode )
        {
            ro = g_ghostCenterPt + vec3(0,2,0) - 7.*normalize(vec3(ghostForwardDir.x, 0, ghostForwardDir.z));
            lookDir = g_ghostCenterPt + vec3(0,1,0);
        }
    }

    g_traceBits = vec4(0);

    vec2 uv = (gl_FragCoord.xy - .5*vec2(s_renderWidth., s_renderHeight.))/s_renderHeight.;
    vec3 roo = ro;
    vec3 f = normalize(lookDir - ro);
    vec3 r = normalize(cross(camUp, f));
    vec3 i = ro + f + uv.x * r + uv.y * cross(f, r);
    vec3 rd = normalize(i - ro);

    vec3 normal = vec3( 0 );
    float planeDist = -roo.y / rd.y;
    float material = 0.;
    float i_objDist = traceObjects( ro, rd );
    // Debug car ray trace bounds
    //      if( i_objDist < 10000. ) { gl_FragColor = vec4(1); return; }
    float traceD = Xt( ro, rd, i_objDist );

    if( traceD < 200. )
    {
        if( rd.y < 0. && planeDist < traceD )
        {
            ro = roo + planeDist * rd;
            normal = vec3( 0, 1, 0 );
            material = 1.;
        }
        else if( traceD >= 0. )
        {
            ro += rd * traceD;
            vec2 dist;
            float totalDist = traceD;

            const float i_EPS = .01;
            for( int i = 0; i < 100; ++i )
            {
                dist = map( ro );
                if( dist.x < i_EPS || totalDist >= 200. || ro.y < 0. ) break;
                totalDist += dist.x;
                ro += rd * dist.x;
            }

            if( ro.y < 0. || dist.x >= i_EPS && rd.y < 0. )
            {
                ro = roo + planeDist * rd;
                normal = vec3( 0, 1, 0 );
                material = 1.;
            }
            else if( dist.x < i_EPS )
            {
                g_traceBits = vec4(i_BITS_ALL);
                normal = getNorm( ro );
                material = dist.y;
            }
        }
        else if( rd.y < 0. )
        {
            ro = roo + planeDist * rd;
            normal = vec3( 0, 1, 0 );
            material = 1.;
        }
    }
    else if( rd.y < 0. )
    {
        ro = roo + planeDist * rd;
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
        g_traceBits = vec4(0);
        rd = normalize( vec3( -.5, .3, 1 ));
        float d, t = .1, traceD = Xt( ro, rd, traceObjects( ro, rd ));
        if( traceD >= 0. )
        {
            for( int i = 0; i < 50; ++i )
            {
                if( t >= 30. ) break;
                d = map( ro + rd*t ).x;
                if( d < 0.01 ) {
                    material *= -1.;
                    break;
                }
                t += max( .1, d );
            }
        }
    }

    gl_FragColor = vec4( normal, material );
}

#endif

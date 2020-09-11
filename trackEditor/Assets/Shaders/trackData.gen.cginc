// Generated from track editor script
static const float i_MAT_ROAD = 2.;
static const float i_MAT_BUMPER = 3.;
static const float i_MAT_CHECKPOINT = 4.;
static const float i_MAT_CHECKPOINT_GOT = 5.;
static const float i_MAT_GHOST0 = 10.;
static const float i_MAT_CAR0 = 15.;
static const float i_MAT_CAR1 = 15.5;
static const float i_MAT_CAR2 = 16.;
static const float i_MAT_CAR3 = 16.5;
static const float i_MAT_CAR4 = 17.;
static const float i_MAT_CAR5 = 17.5;
static const float i_MAT_CAR6 = 18.;

static const float i_BIT0 = 1.;
static const float i_BIT1 = 2.;
static const float i_BIT2 = 4.;
static const float i_BIT3 = 8.;
static const float i_BIT4 = 16.;
static const float i_BIT5 = 32.;
static const float i_BIT6 = 64.;
static const float i_BIT7 = 128.;
static const float i_BIT8 = 256.;
static const float i_BIT9 = 512.;
static const float i_BITS_ALL = 1023.;

// ================================================================================================

float3x3 quat( float4 q ) {
    return transpose_hlsl_only(float3x3(
        1. - 2.*q.y*q.y - 2.*q.z*q.z,
             2.*q.y*q.x + 2.*q.w*q.z,
             2.*q.z*q.x - 2.*q.w*q.y,
                 2.*q.y*q.x - 2.*q.w*q.z,
            1. - 2.*q.x*q.x - 2.*q.z*q.z,
                 2.*q.z*q.y + 2.*q.w*q.x,
                     2.*q.z*q.x + 2.*q.w*q.y,
                     2.*q.z*q.y - 2.*q.w*q.x,
                1. - 2.*q.x*q.x - 2.*q.y*q.y
    ));
}

float2x2 rot( float t )
{
    float s = sin(t), c = cos(t);
    return transpose_hlsl_only(float2x2(c, s, -s, c));
}

float2 min2( float2 a, float2 b )
{
    return a.x < b.x ? a : b;
}

float sdBox( float3 p, float3 b )
{
    float3 q = abs(p) - b;
    return length(max(q,0.)) + min(max(q.x,max(q.y,q.z)),0.);
}

float sdBox2D( float2 p, float2 b )
{
    float2 d = abs(p) - b;
    return length(max(d,0.)) + min(max(d.x,d.y),0.);
}

float2 opSmoothUnion2( float2 d1, float2 d2, float k )
{
    float h = clamp( .5 + .5*(d2.x-d1.x)/k, 0., 1. );
    return float2( lerp( d2.x, d1.x, h ) - k*h*(1.-h), d1.y );
}

// ================================================================================================
//  Box

float2 sdObj0( 
    float3 p,
    float qx, float qy, float qz, float qw, float px, float py, float pz,
    float sx, float sy, float sz
) {
    p = mul( quat(float4(qx,qy,qz,qw)) , (p - float3(px,py,pz)) ); //GLSL// p = quat(float4(qx,qy,qz,qw)) * (p - float3(px,py,pz));
    p.z -= sz;

    float3 rep = floor(.25 * p + .01);
    return float2( sdBox( p, float3(sx, sy, sz) ), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.));
}

// ================================================================================================
//  Straight track

float sdVerticalCapsule( float3 p, float h, float r )
{
    p.z -= clamp( p.z, -h, h );
    return length( p ) - r;
}

float2 sdObj1(
    float3 p,
    float qx, float qy, float qz, float qw, float px, float py, float pz,
    float trackWidth, float trackLength, float twist
) {
    p = mul( quat(float4(qx,qy,qz,qw)) , (p - float3(px,py,pz)) ); //GLSL// p = quat(float4(qx,qy,qz,qw)) * (p - float3(px,py,pz));
    p.z -= trackLength;

    if( abs(twist) > 1. )
        p.xy = mul(rot( 1./twist*(p.z+trackLength) ), p.xy);  //GLSL// p.xy = rot( 1./twist*(p.z+trackLength) ) * p.xy;

    float3 rep = floor(.25 * p + .01);

    return min2(
        float2( sdBox( p, float3(trackWidth,.5,trackLength)), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.) ),
        float2( sdVerticalCapsule( float3(abs(p.x),p.yz) - float3(trackWidth,0,0), trackLength, 1. ), i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) )
    );
}

// ================================================================================================
//  Curved track

float2 primitive( float2 p, float sx, float bank, float pz )
{
    p = mul(rot(bank), p);  //GLSL//  p = rot(bank) * p;

    float3 rep = floor( float3(p.xy, pz) / 4. + .01);

    return min2(
        float2( sdBox2D( p, float2( sx, .5 )), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.) ),
        float2( length(float2(abs(p.x)-sx,p.y)) - 1., i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) )
    );
}

float2 opRevolution( float3 p, float sx, float radius, float bank )
{
    float len = length(p.xz);
    float2 q = float2( len - radius, p.y );
    float theta = atan2( p.z, p.x ) * radius;
    return primitive(q, sx, bank, theta);
}

float2 opExtrusion( float3 p, float sx, float radius, float bank )
{
    p.x -= radius;
    float2 d = primitive(p.xy, sx, bank, 0.);
    float2 w = float2( d.x, abs(p.z));
    return float2(min(max(w.x,w.y),0.0) + length(max(w,0.0)), d.y);
}

float2 sdObj2( 
    float3 po,
    float qx, float qy, float qz, float qw, float px, float py, float pz,
    float trackWidth, float radius, float bank
) {
    float3 p = mul( quat(float4(qx,qy,qz,qw)) , (po - float3(px,py,pz)) ); //GLSL// vec3 p = quat(float4(qx,qy,qz,qw)) * (po - float3(px,py,pz));

    if( radius < 0. ) {
        radius *= -1.;
        p.x *= -1.;
    }

    p.x += radius;
    float2 d = p.x > 0. && p.z > 0. ? opRevolution( p, trackWidth, radius, bank ) : float2(10000.,0.); // sdObj0( p, s );
    float2 d1 = opExtrusion( p, trackWidth, radius, bank );
    float2 d2 = opExtrusion( p.zyx, trackWidth, radius, bank );
    return min2(d,min2(d1,d2));
}

// ================================================================================================

float2 sdCheckpoint( float3 p, float3 center, float4 rot, float goalState )
{
    float i_checkpointThickness = .4;

    p -= center;
    p = mul(quat(rot), p); //GLSL// p = quat(rot) * p;

    float3 rep = floor(.5 * p);

    float2 p1 = abs(p.xy);
    p1 -= 2.*min(dot(float2(-.866,.5),p1),0.)*float2(-.866,.5);
    p1 -= float2(clamp(p1.x, -2.31, 2.31), 4);

    float2 w = float2( abs( max(
        sdBox2D( p.xy - float2(0,4.62), float2(4.62,4.62)), //GLSL// sdBox2D( p.xy - vec2(0,4.62), vec2(4.62)),
        length(p1)*sign(p1.y)
    ) ) - i_checkpointThickness, abs(p.z) - i_checkpointThickness );

    float d = min(max(w.x,w.y),0.) + length(max(w,0.));

    return float2( d, (goalState > 0. ? i_MAT_CHECKPOINT_GOT : i_MAT_CHECKPOINT) + .5 * mod(rep.x + rep.y + rep.z, 2.) );
}

// ================================================================================================

void traceBox(
    float3 ro, float3 rd, inout float dist, inout float bits, float bit,
    float qx, float qy, float qz, float qw,
    float px, float py, float pz,
    float sx, float sy, float sz
) {    
    float3x3 q = quat(float4(qx,qy,qz,qw));
    ro = mul(q, ro-float3(px,py,pz)); //GLSL// ro = q*(ro-float3(px,py,pz));
    rd = mul(q, rd); //GLSL// rd = q*rd;
    float3 b = float3(sx,sy,sz);

    ro.z -= b.z-.5;
    b.z += .5;

    if(length(step(-b, ro) - step(b, ro))>1.5) 
    {
        bits += bit;
        dist = 0.;
    }
    else
    {
        rd = 1. / rd;
        float t1, t2,
            tmin = -10000., tmax = 10000.,
            x = b.x, y = ro.x;
        t1 = (-x - y) * rd.x;
        t2 = ( x - y) * rd.x;
        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));

        x = b.y, y = ro.y;
        t1 = (-x - y) * rd.y;
        t2 = ( x - y) * rd.y;
        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));

        x = b.z, y = ro.z;
        t1 = (-x - y) * rd.z;
        t2 = ( x - y) * rd.z;
        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));

        if( tmax >= tmin && tmin >= 0. )
        {
            bits += bit;
            if( tmin < dist )
                dist = tmin;
        }
    }
}
static const float3 Xc0 = float3(0.44,0.13,53.7),Xc1 = float3(78.07,7.96,166.05),Xc2 = float3(23.58,8.11,162.77),Xc3 = float3(65.47,7.93,166.48);
static const float4 Xf0 = float4(0,0,0,1),Xf1 = float4(0,-0.69,0,0.724),Xf2 = float4(0.12,-0.468,0.199,0.853),Xf3 = float4(0.07,-0.704,0.07,0.704),Xp0 = float4(75.4,0,114.7,40);
float2 Xm( float3 p )
{
float2 d = float2( 10000, 0 );
if( mod( g_traceBits.y / i_BIT0, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.,0.,-0.707,0.707,95.5,-0.5,108.83 ,10.,-20.,-1.57 ) );
if( mod( g_traceBits.y / i_BIT1, 2. ) >= 1. )
d = min2( d, sdObj0( p, 0.119,0.,0.,0.993,0.5,-2.19,-39.91 ,3.549,0.5,5.093 ) );
if( mod( g_traceBits.y / i_BIT2, 2. ) >= 1. )
d = min2( d, sdObj0( p, 0.,0.,0.,1.,69.,39.5,135.6 ,18.917,18.917,5.242 ) );
if( mod( g_traceBits.y / i_BIT3, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.,0.,1.,0.5,8.2,86.35 ,4.,20.,80. ) );
if( mod( g_traceBits.y / i_BIT4, 2. ) >= 1. )
d = min2( d, sdObj0( p, 0.109,-0.195,-0.44,0.87,19.63,-2.73,93.83 ,5.,5.,5. ) );
if( mod( g_traceBits.y / i_BIT5, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.,0.,-0.707,0.707,56.7,-0.5,108.83 ,10.,-20.,-1.57 ) );
if( mod( g_traceBits.y / i_BIT6, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.,0.,0.,1.,0.5,8.2,126.32 ,4.,-40.,-0.5 ) );
if( mod( g_traceBits.y / i_BIT7, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.707,0.,0.707,80.5,8.2,166.31 ,4.,20.,-80. ) );
if( mod( g_traceBits.y / i_BIT8, 2. ) >= 1. )
{
float2 d1 = opSmoothUnion2(sdObj1( p, 0.,0.,0.,1.,0.5,0.21,-30.12 ,4.,50.,0. ),sdObj0( p, 0.313,0.,0.,0.95,0.5,-2.69,62.28 ,2.29,0.5,5.093 ),2.);
d = min2( d, d1 );
}
return d;
}
float Xt( float3 ro, float3 rd, float dist )
{
traceBox( ro, rd, dist, g_traceBits.y, i_BIT0, 0.,0.,-0.707,0.707,95.5,1.5,108.83,23.,11.,13. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT1, 0.119,0.,0.,0.993,0.5,-2.19,-39.91,3.549,0.5,5.093 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT2, 0.,0.,0.,1.,69.,39.5,135.6,18.917,18.917,5.242 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT3, 0.,0.,0.,1.,0.5,8.2,86.35,5.,5.,21. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT4, 0.109,-0.195,-0.44,0.87,19.63,-2.73,93.83,5.,5.,5. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT5, 0.,0.,-0.707,0.707,56.7,1.5,108.83,23.,11.,13. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT6, 0.,0.,0.,1.,18.5,8.2,126.32,43.,5.,23. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT7, 0.,0.707,0.,0.707,80.5,8.2,166.31,5.,5.,21. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT8, 0.,0.,0.,1.,0.,1.07,-30.16,6.,3.,51. );
return dist < 10000. ? dist : -1.;
}

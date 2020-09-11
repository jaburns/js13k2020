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

float3x3 quat( float x, float y, float z, float w ) {
    return transpose_hlsl_only(float3x3(
        1. - 2.*y*y - 2.*z*z,
        2.*y*x + 2.*w*z,
        2.*z*x - 2.*w*y,
            2.*y*x - 2.*w*z,
            1. - 2.*x*x - 2.*z*z,
            2.*z*y + 2.*w*x,
                2.*z*x + 2.*w*y,
                2.*z*y - 2.*w*x,
                1. - 2.*x*x - 2.*y*y
    ));
}

float3x3 quat( float4 q )
{
    return quat( q.x, q.y, q.z, q.w );
}

float2x2 rot( float t )
{
    return transpose_hlsl_only(float2x2(cos(t), sin(t), -sin(t), cos(t)));
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

float2 sdObj0( float3 p, float3 s )
{
    p.z -= s.z;
    float3 rep = floor(.25 * p + .01);
    return float2( sdBox( p, s ), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.));
}

// ================================================================================================
//  Straight track

float sdVerticalCapsule( float3 p, float h, float r )
{
    p.z -= clamp( p.z, -h, h );
    return length( p ) - r;
}

float2 sdObj1( float3 p, float3 s, float twist )
{
    p.z -= s.z;
    if( abs(twist) > 1. )
        p.xy = mul(rot( 1./twist*(p.z+s.z) ), p.xy);  //GLSL// p.xy = rot( 1./twist*(p.z+s.z) ) * p.xy;

    float3 rep = floor(.25 * p + .01);

    return min2(
        float2( sdBox( p, float3(s.x,.5,s.z)), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.) ),
        float2( sdVerticalCapsule( float3(abs(p.x),p.yz) - float3(s.x,0,0), s.z, 1. ), i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) )
    );
}

// ================================================================================================
//  Curved track

float2 primitive( float2 p, float sx, float bank, float pz )
{
    p = mul(rot(bank) , p);  //GLSL//  p = rot(bank) * p;

    float3 rep = floor( float3(p.xy, pz) / 4. + .01);

    return min2(
        float2( sdBox2D( p, float2( 4, .5 )), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.) ),
        float2( length(float2(abs(p.x)-4.,p.y)) - 1., i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) )
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

float2 sdObj2( float3 p, float3 s, float radius, float bank )
{ 
    if( radius < 0. ) {
        radius *= -1.;
        p.x *= -1.;
    }

    p.x += radius;
    float2 d = p.x > 0. && p.z > 0. ? opRevolution( p, s.x, radius, bank ) : float2(10000.,0.); // sdObj0( p, s );
    float2 d1 = opExtrusion( p, s.x, radius, bank );
    float2 d2 = opExtrusion( p.zyx, s.x, radius, bank );
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

float traceBox( float3 ro, float3 rd, float3 b )
{    
    ro.z -= b.z-.5;
    b.z += .5;

    if(length(step(-b, ro) - step(b, ro))>1.5)
        return 0.;

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
    t1 = (-x - y) * rd.z; t2 = ( x - y) * rd.z;
    tmin = max(tmin, min(t1, t2));
    tmax = min(tmax, max(t1, t2));

    return tmax >= tmin ? tmin : -1.;
}

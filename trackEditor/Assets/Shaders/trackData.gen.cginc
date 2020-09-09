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

float traceBox( float3 ro, float3 rd, float3 b )
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

    return tmax >= tmin ? tmin : -1.;
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

float sdVerticalCapsule( float3 p, float h, float r )
{
    p.z -= clamp( p.z, -h, h );
    return length( p ) - r;
}

float2 opSmoothUnion2( float2 d1, float2 d2, float k )
{
    float h = clamp( .5 + .5*(d2.x-d1.x)/k, 0., 1. );
    return float2( lerp( d2.x, d1.x, h ) - k*h*(1.-h), d1.y );
}
// Box
float2 sdObj0( float3 p, float3 s )
{
    p.z -= s.z;
    float3 rep = floor(p / 4. + .01);
    return float2( sdBox( p, s ), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.));
}

// Straight Track
float2 sdObj1( float3 p, float3 s, float twist )
{
    p.z -= s.z;
    if( abs(twist) > 1. )
        p.xy = mul(rot( 1./twist*(p.z+s.z) ), p.xy);  //GLSL// p.xy = rot( 1./twist*(p.z+s.z) ) * p.xy;

    float3 rep = floor(p / 4. + .01);

    return min2(
        float2( sdBox( p, float3(s.x,.5,s.z)), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.) ),
        float2( sdVerticalCapsule( float3(abs(p.x),p.yz) - float3(s.x,0,0), s.z, 1. ), i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) )
    );
}

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
    float theta = atan2( p.z, p.x ) * len;
    return primitive(q, sx, bank, theta);
}

float2 opExtrusion( float3 p, float sx, float radius, float bank )
{
    p.x -= radius;
    float2 d = primitive(p.xy, sx, bank, 0.);
    float2 w = float2( d.x, abs(p.z));
    return float2(min(max(w.x,w.y),0.0) + length(max(w,0.0)), d.y);
}

// Curve track
float2 sdObj2( float3 p, float3 s, float radius, float bank )
{ 
    if( radius < 0. ) {
        radius *= -1.;
        p.x *= -1.;
    }

    //p -= float3(0,0,s.z);
    p.x += radius;
    float2 d = p.x > 0. && p.z > 0. ? opRevolution( p, s.x, radius, bank ) : float2(10000.,0.); // sdObj0( p, s );
    float2 d1 = opExtrusion( p, s.x, radius, bank );
    float2 d2 = opExtrusion( p.zyx, s.x, radius, bank );
    return min2(d,min2(d1,d2));
}





static const float i_thicc = .4;

float sdHex( float2 p, float r )
{
    const float3 k = float3(-0.866025404,0.5,0.577350269);
    p = abs(p);
    p -= 2.0*min(dot(k.xy,p),0.0)*k.xy;
    p -= float2(clamp(p.x, -k.z*r, k.z*r), r);
    return length(p)*sign(p.y);
}

float sdPentagon( float2 p, float r )
{
    float dhex = sdHex( p, r );
    r /= 0.866025404;
    float dbox = sdBox2D( p - float2(0,r), float2(r,r) );
    float d = max( dbox, dhex );
    //float d = p.y < 0. ? dbox : dhex < 0. ? max( dbox, dhex ) : dhex;
    
    return abs( d ) - i_thicc;
}

float sdGoal1( float3 p )
{
    float     h = i_thicc;
    float d = sdPentagon(p.xy, 4.);
    float2 w = float2( d, abs(p.z) - h );
    return min(max(w.x,w.y),0.0) + length(max(w,0.0));
}
float2 sdCheckpoint( float3 p, float3 center, float4 rot, float goalState )
{
    p -= center;
    p = mul(quat(rot), p); //GLSL// p = quat(rot.x,rot.y,rot.z,rot.w) * p;

    float3 rep = floor(p / 4. + .01);
    return float2( sdGoal1( p ), (goalState > 0. ? i_MAT_CHECKPOINT_GOT : i_MAT_CHECKPOINT) + .5 * mod(rep.x + rep.y + rep.z, 2.) );
}
static const float3 Xc0 = float3(0.44,0.13,53.7),Xc1 = float3(78.07,7.96,166.05),Xc2 = float3(23.58,8.11,162.77),Xc3 = float3(65.47,7.93,166.48);
static const float4 Xf0 = float4(0,0,0,1),Xf1 = float4(0,-0.69,0,0.724),Xf2 = float4(0.12,-0.468,0.199,0.853),Xf3 = float4(0.07,-0.704,0.07,0.704),Xp0 = float4(0.5,8.2,165.7,40);
float2 Xmap( float3 p )
{
float2 d = sdObj0( mul(quat(0.119,0,0,0.993),p-float3(0.5,-2.19,-39.91)), float3(3.549,0.5,5.093)  );
d = min2( d, sdObj0( mul(quat(-0.25,-0.551,-0.688,0.401),p-float3(-71,-9.6,127.4)), float3(18.917,18.917,18.917)  ) );
d = min2( d, sdObj1( mul(quat(0,0,0,1),p-float3(0.5,8.2,86.35)), float3(4,0.5,20) ,80. ) );
d = min2( d, sdObj0( mul(quat(0.109,-0.195,-0.44,0.87),p-float3(19.63,-2.73,93.83)), float3(5,5,5)  ) );
d = min2( d, sdObj2( mul(quat(0,0,0,1),p-float3(0.5,8.2,126.32)), float3(4,0.5,20) ,-40.,-0.5 ) );
d = min2( d, sdObj1( mul(quat(0,0.707,0,0.707),p-float3(80.5,8.2,166.31)), float3(4,0.5,20) ,-80. ) );
{
float2 d1 = opSmoothUnion2(sdObj1( mul(quat(0,0,0,1),p-float3(0.5,0.17,-30.13)), float3(4,0.5,50) ,0. ),sdObj0( mul(quat(0.313,0,0,0.95),p-float3(0.5,-2.73,62.27)), float3(2.29,0.5,5.093)  ),2.);
d = min2( d, d1 );
}
return d;
}

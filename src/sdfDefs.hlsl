static const float i_MAT_ROAD = 2.;
static const float i_MAT_BUMPER = 3.;
static const float i_MAT_CHECKPOINT = 4.;
static const float i_MAT_CHECKPOINT_GOT = 5.;
static const float i_MAT_SPEEDER = 6.;
static const float i_MAT_SLOWER = 7.;
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

float2 opSubtract2( float2 a, float2 b, float innerMat )
{
    return -a.x > b.x ? float2( -a.x, innerMat + frac(a.y) ) : b;
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
    return float2( lerp( d2.x, d1.x, h ) - k*h*(1.-h), d1.x < d2.x ? d1.y : d2.y );
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
    float trackWidth, float trackLength, float twist, float material, float bumper
) {
    p = mul( quat(float4(qx,qy,qz,qw)) , (p - float3(px,py,pz)) ); //GLSL// p = quat(float4(qx,qy,qz,qw)) * (p - float3(px,py,pz));
    p.z -= trackLength;

    if( abs(twist) > 1. )
        p.xy = mul(rot( 1./twist*(p.z+trackLength) ), p.xy);  //GLSL// p.xy = rot( 1./twist*(p.z+trackLength) ) * p.xy;

    float3 rep = floor(.25 * p + .01);
    float2 track = float2( sdBox( p, float3(trackWidth,.5,trackLength)), material + .5 * mod(rep.x + rep.y + rep.z, 2.) );

    return bumper > 0. ? min2(
        track,
        float2( sdVerticalCapsule( float3(abs(p.x),p.yz) - float3(trackWidth,0,0), trackLength, 1. ), i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) )
    ) : track;
}

// ================================================================================================
//  Curved track

float2 primitive( float2 p, float sx, float bank, float pz, float bumper )
{
    p = mul(rot(bank), p);  //GLSL//  p = rot(bank) * p;

    float3 rep = floor( float3(p.xy, pz) / 4. + .01);
    float2 track = float2( sdBox2D( p, float2( sx, .5 )), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.) );

    return bumper > 0. ? min2(
        track,
        float2( length(float2(abs(p.x)-sx,p.y)) - 1., i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) )
    ) : track;
}

float2 opRevolution( float3 p, float sx, float radius, float bank, float bumper )
{
    float theta = atan2( p.z, p.x ) * radius;
    float len = length(p.xz);
    float2 q = float2( len - radius, p.y );
    return primitive(q, sx, bank, theta, bumper);
}

float2 opExtrusion( float3 p, float sx, float radius, float bank, float bumper )
{
    p.x -= radius;
    float2 d = primitive(p.xy, sx, bank, 0., bumper);
    float2 w = float2( d.x, abs(p.z));
    return float2(min(max(w.x,w.y),0.) + length(max(w,0.)), d.y);
}

float2 sdObj2( 
    float3 p,
    float qx, float qy, float qz, float qw, float px, float py, float pz,
    float trackWidth, float radius, float bank, float bumper, float material
) {
    p = mul( quat(float4(qx,qy,qz,qw)) , (p - float3(px,py,pz)) ); //GLSL// p = quat(float4(qx,qy,qz,qw)) * (p - float3(px,py,pz));

    if( radius < 0. ) {
        radius *= -1.;
        p.x *= -1.;
    }

    p.x += radius;
    float2 d = p.x > 0. && p.z > 0. ? opRevolution( p, trackWidth, radius, bank, bumper ) : float2(10000.,0.);
    float2 d1 = opExtrusion( p, trackWidth, radius, bank, bumper );
    float2 d2 = opExtrusion( p.zyx, trackWidth, radius, bank, bumper );
    float2 ret = min2(d,min2(d1,d2));
    if( ret.y < i_MAT_BUMPER ) ret.y += material - i_MAT_ROAD;
    return ret;
}

// ================================================================================================
//  Shrinking width track

float sdCapsule3( float3 p, float3 a, float3 b, float r )
{
    float3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0., 1. );
    return length( pa - ba*h ) - r;
}

float sdTrapezoid3( float2 p, float r1, float r2, float he )
{
    float2 k1 = float2(r2,he);
    float2 k2 = float2(r2-r1,2.*he);

    // p.x = abs( p.x );
    float2 ca = float2(max(0.,p.x-((p.y<0.)?r1:r2)), abs(p.y)-he);
    float2 cb = p - k1 + k2*clamp( dot(k1-p,k2)/dot(k2,k2), 0., 1. );
    float s = (cb.x < 0. && ca.y < 0.) ? -1. : 1.;
    
    return s*sqrt( min(dot(ca,ca),dot(cb,cb)) );
}

float opExtrusion3( float3 p,float r1, float r2, float he )
{
    float d = sdTrapezoid3( p.xz, r1, r2, he );
    float2 w = float2( d, abs(p.y) - .5 );
    return min(max(w.x,w.y),0.) + length(max(w,0.));
}

float2 sdObj3( 
    float3 p,
    float qx, float qy, float qz, float qw, float px, float py, float pz,
    float trackWidthA, float trackLength, float trackWidthB, float bumper
) {
    p = mul( quat(float4(qx,qy,qz,qw)) , (p - float3(px,py,pz)) ); //GLSL// p = quat(float4(qx,qy,qz,qw)) * (p - float3(px,py,pz));
    p.z -= trackLength;

    float3 rep = floor(.25 * p + .01);

    p.x = abs( p.x );

    float2 track = float2( opExtrusion3( p, trackWidthA, trackWidthB, trackLength ), i_MAT_ROAD + .5 * mod(rep.x + rep.y + rep.z, 2.) );
    return bumper > 0. ? min2(
        track,
        float2( sdCapsule3( p, float3( trackWidthA, 0, -trackLength ), float3( trackWidthB, 0, trackLength ), 1. ), i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) )
    ) : track;
}

// ================================================================================================

float2 sdObj4( 
    float3 p,
    float qx, float qy, float qz, float qw, float px, float py, float pz,
    float length, float radius
) {
    p = mul( quat(float4(qx,qy,qz,qw)) , (p - float3(px,py,pz)) ); //GLSL// p = quat(float4(qx,qy,qz,qw)) * (p - float3(px,py,pz));
    p.z -= length;
    float3 rep = floor(.25 * p + .01);
    return float2( sdVerticalCapsule( p, length, radius ), i_MAT_BUMPER + .5 * mod(rep.x + rep.y + rep.z, 2.) );
}

// ================================================================================================

float2 sdCheckpoint( float3 p, float3 center, float4 rota, float goalState )
{
    float i_checkpointThickness = .4;

    p -= center;
    p = mul(quat(rota), p); //GLSL// p = quat(rota) * p;
    //GLSL// p.xy *= rot( u_time );

    float3 rep = floor(.5 * p);

    float2 p1 = abs(p.xy);
    p1 -= 2.*min(dot(float2(-.866,.5),p1),0.)*float2(-.866,.5);
    p1 -= float2(clamp(p1.x, -2.31, 2.31), 4);

    float2 w = float2(length(p1), abs(p.z)) - i_checkpointThickness;
    float d = min(max(w.x,w.y),0.) + length(max(w,0.));

    return float2( d, (goalState == 2. ? i_MAT_CHECKPOINT_GOT : i_MAT_CHECKPOINT) + .5 * mod(rep.x + rep.y + rep.z, 2.) );
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
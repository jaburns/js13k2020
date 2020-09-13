// Generated from track editor script
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
static const float3 Xc0 = float3(99,118.44,115.8),Xc1 = float3(11.2,69.66,207.11),Xc2 = float3(87.87,71.45,200.5),Xc3 = float3(47.43,13.97,165.39);
static const float4 Xf0 = float4(0,-0.707,0,0.707),Xf1 = float4(0,0,0,1),Xf2 = float4(-0.492,-0.012,0.022,0.87),Xf3 = float4(0,-0.707,0,0.707),Xp0 = float4(39.1,29.5,573.5,500),Xp1 = float4(600,29.5,80.7,100);
float2 Xm( float3 p )
{
float2 d = float2( 10000, 0 );
if( mod( g_traceBits.x / i_BIT6, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.,0.,0.,1.,19.5,12.4,247. ,7.5,-40.,-1.,0.,6. ) );
if( mod( g_traceBits.x / i_BIT7, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.707,0.,0.707,137.8,12.4,287. ,7.5,20.,0.,2.,0. ) );
if( mod( g_traceBits.x / i_BIT8, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.259,0.,0.,0.966,0.,16.75,167.16 ,7.5,15.,19.,2.,0. ) );
if( mod( g_traceBits.x / i_BIT9, 2. ) >= 1. )
d = min2( d, sdObj3( p, 0.,0.,0.,1.,0.,9.,-12.3 ,15.,25.,7.5,1. ) );
if( mod( g_traceBits.y / i_BIT0, 2. ) >= 1. )
d = min2( d, sdObj2( p, -0.707,-0.707,0.,0.,90.3,95.,142.6 ,7.5,-30.,-1.57,0.,2. ) );
if( mod( g_traceBits.y / i_BIT1, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.707,-0.707,0.,0.,12.,72.4,207. ,15.,-30.,-1.57,0.,2. ) );
if( mod( g_traceBits.y / i_BIT2, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.259,0.,0.,0.966,0.,31.74,193.14 ,7.5,-30.,1.57,0.,2. ) );
if( mod( g_traceBits.y / i_BIT3, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,-1.,0.,0.,90.3,95.,187.6 ,7.5,22.5,0.,2.,0. ) );
if( mod( g_traceBits.y / i_BIT4, 2. ) >= 1. )
d = min2( d, sdObj2( p, -0.001,-0.487,0.873,-0.019,90.187,70.137,202.487 ,7.5,-30.,1.57,0.,2. ) );
if( mod( g_traceBits.y / i_BIT5, 2. ) >= 1. )
d = min2( d, sdObj2( p, -0.707,-0.707,0.,0.,19.5,12.4,207. ,7.5,-30.,-1.57,0.,2. ) );
if( mod( g_traceBits.y / i_BIT6, 2. ) >= 1. )
d = min2( d, sdObj2( p, -0.707,-0.707,0.,0.,117.8,12.4,225.5 ,20.,-115.,-1.57,0.,2. ) );
if( mod( g_traceBits.y / i_BIT7, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.,0.,0.707,0.707,12.,72.4,207. ,15.,-30.,-1.57,0.,2. ) );
if( mod( g_traceBits.y / i_BIT8, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.,-1.,0.,0.,4.5,12.4,207. ,7.5,40.,0.,0.,2. ) );
if( mod( g_traceBits.y / i_BIT9, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.707,0.,0.707,99.5,12.4,287. ,7.5,20.,-40.,2.,0. ) );
if( mod( g_traceBits.z / i_BIT0, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.,0.,1.,19.5,12.4,207. ,7.5,20.,40.,2.,0. ) );
if( mod( g_traceBits.z / i_BIT1, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.619,0.605,0.352,0.357,90.232,69.665,202.828 ,7.5,15.,-19.,2.,0. ) );
if( mod( g_traceBits.z / i_BIT2, 2. ) >= 1. )
d = min2( d, sdObj2( p, 0.,0.,0.707,-0.707,4.5,12.4,207. ,7.5,-30.,-1.57,0.,2. ) );
if( mod( g_traceBits.z / i_BIT3, 2. ) >= 1. )
d = min2( d, sdObj0( p, 0.,0.,0.,1.,117.8,12.4,225.5 ,20.,0.5,27.25 ) );
if( mod( g_traceBits.z / i_BIT4, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.617,-0.358,0.618,0.331,29.612,46.725,219.271 ,7.5,15.,-19.,2.,0. ) );
if( mod( g_traceBits.z / i_BIT5, 2. ) >= 1. )
d = min2( d, sdObj1( p, 0.,0.,0.,1.,0.,9.,37.7 ,7.5,52.3,0.,6.,0. ) );
if( mod( g_traceBits.z / i_BIT6, 2. ) >= 1. )
{
float2 d1 = opSmoothUnion2(sdObj1( p, 0.259,0.,0.,0.966,0.,6.75,149.84 ,7.5,10.,0.,2.,0. ),sdObj1( p, 0.,0.,0.,1.,0.,9.,142.3 ,7.5,10.,0.,2.,0. ),5.);
d = min2( d, d1 );
}
return d;
}
float Xt( float3 ro, float3 rd, float dist )
{
traceBox( ro, rd, dist, g_traceBits.x, i_BIT6, 0.,0.,0.,1.,35.25,12.4,247.,25.25,9.5,25.25 );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT7, 0.,0.707,0.,0.707,137.8,12.4,287.,8.5,1.5,21. );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT8, 0.259,0.,0.,0.966,0.,16.75,167.16,8.5,8.5,16. );
traceBox( ro, rd, dist, g_traceBits.x, i_BIT9, 0.,0.,0.,1.,0.,9.,-12.3,16.,1.5,26. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT0, -0.707,-0.707,0.,0.,90.3,105.75,142.6,20.25,9.5,20.25 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT1, 0.707,-0.707,0.,0.,12.,65.4,207.,24.,17.,24. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT2, 0.259,0.,0.,0.966,10.75,31.74,193.14,20.25,9.5,20.25 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT3, 0.,-1.,0.,0.,90.3,95.,187.6,8.5,1.5,23.5 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT4, -0.001,-0.487,0.873,-0.019,79.445,70.513,202.668,20.25,9.5,20.25 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT5, -0.707,-0.707,0.,0.,19.5,23.15,207.,20.25,9.5,20.25 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT6, -0.707,-0.707,0.,0.,117.8,59.4,225.5,69.,22.,69. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT7, 0.,0.,0.707,0.707,12.,65.4,207.,24.,17.,24. );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT8, 0.,-1.,0.,0.,20.25,12.4,207.,25.25,9.5,25.25 );
traceBox( ro, rd, dist, g_traceBits.y, i_BIT9, 0.,0.707,0.,0.707,99.5,12.4,287.,8.5,8.5,21. );
traceBox( ro, rd, dist, g_traceBits.z, i_BIT0, 0.,0.,0.,1.,19.5,12.4,207.,8.5,8.5,21. );
traceBox( ro, rd, dist, g_traceBits.z, i_BIT1, 0.619,0.605,0.352,0.357,90.232,69.665,202.828,8.5,8.5,16. );
traceBox( ro, rd, dist, g_traceBits.z, i_BIT2, 0.,0.,0.707,-0.707,4.5,23.15,207.,20.25,9.5,20.25 );
traceBox( ro, rd, dist, g_traceBits.z, i_BIT3, 0.,0.,0.,1.,117.8,12.4,225.5,20.,0.5,27.25 );
traceBox( ro, rd, dist, g_traceBits.z, i_BIT4, 0.617,-0.358,0.618,0.331,29.612,46.725,219.271,8.5,8.5,16. );
traceBox( ro, rd, dist, g_traceBits.z, i_BIT5, 0.,0.,0.,1.,0.,9.,37.7,8.5,1.5,53.3 );
traceBox( ro, rd, dist, g_traceBits.z, i_BIT6, 0.,0.,0.,1.,0.,9.,142.3,7.5,11.5,15.75 );
return dist < 10000. ? dist : -1.;
}

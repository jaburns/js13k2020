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

float sdVerticalCapsule( float3 p, float h, float r )
{
    p.z -= clamp( p.z, -h, h );
    return length( p ) - r;
}

float sdCappedCylinder( float3 p, float h, float r )
{
    float2 d = abs(float2(length(p.yx),p.z)) - float2(r,h);
    return min(max(d.x,d.y),0.) + length(max(d,0.));
}

float2 opSmoothUnion2( float2 d1, float2 d2, float k )
{
    float h = clamp( .5 + .5*(d2.x-d1.x)/k, 0., 1. );
    return lerp( d2, d1, h ) - k*h*(1.-h);
}
// Box
float2 sdObj0( float3 p, float3 s )
{
    return float2( sdBox( p, s ), 0. );
}

// Straight Track
float2 sdObj1( float3 p, float3 s, float twist )
{
    p.xy = mul(rot( twist*(p.z+s.z) ), p.xy);

    return min2(
        float2( sdBox( p, float3(s.x,.5,s.z)), 0. ),
        float2( min(
            sdCappedCylinder( p - float3(-s.x-.5,0,0), s.z, 1. ),
            sdCappedCylinder( p - float3(s.x+.5,0,0), s.z, 1. )
        ), 1. )
    );
}




float sdBox2D( float2 p, float2 b )
{
    float2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}
float primitive( float2 p )
{
    p = mul(rot(-1.) , p);
    return sdBox2D( p, float2( 4, .5 ));
}
float opRevolution( float3 p )
{
    float2 q = float2( length(p.xz) - 10., p.y );
    return primitive(q);
}
float opExtrusion( float3 p )
{
    p.x -= 10.;
    float d = primitive(p.xy);
    float2 w = float2( d, abs(p.z)); // -1);
    return min(max(w.x,w.y),0.0) + length(max(w,0.0));
}

// Curve track
float2 sdObj2( float3 p, float3 s, float radius, float bank )
{ 
    float d = p.x > 0. && p.z > 0. ? opRevolution( p ) : 10000.; // sdObj0( p, s );
    float d1 = opExtrusion( p );
    float d2 = opExtrusion( p.zyx );
    return float2(min(d,min(d1,d2)), 0);
}

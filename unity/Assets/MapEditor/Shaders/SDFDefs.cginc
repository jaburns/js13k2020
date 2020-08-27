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

float sdBox( float3 p, float3 b )
{
    float3 q = abs(p) - b;
    return length(max(q,0.)) + min(max(q.x,max(q.y,q.z)),0.);
}

float sdCappedCylinder( float3 p, float h, float r )
{
    float2 d = abs(float2(length(p.yx),p.z)) - float2(r,h);
    return min(max(d.x,d.y),0.) + length(max(d,0.));
}

float opSmoothUnion( float d1, float d2, float k )
{
    float h = clamp( .5 + .5*(d2-d1)/k, 0., 1. );
    return lerp( d2, d1, h ) - k*h*(1.-h);
}

// Box
float sdObj0( float3 p, float3 s )
{
    return sdBox( p, s );
}

// Straight Track
float sdObj1( float3 p, float3 s )
{
    return min(
        sdBox( p, float3(s.x,.5,s.z)),
        min(
            sdCappedCylinder( p - float3(-s.x-.5,0,0), s.z, 1. ),
            sdCappedCylinder( p - float3(s.x+.5,0,0), s.z, 1. )
        )
    );
}
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
    p.z -= s.z;
    return float2( sdBox( p, s ), 0. );
}

// Straight Track
float2 sdObj1( float3 p, float3 s, float twist )
{
    p.z -= s.z;
    if( twist > 1. )
        p.xy = mul(rot( 1./twist*(p.z+s.z) ), p.xy);

    return min2(
        float2( sdBox( p, float3(s.x,.5,s.z)), 0. ),
        float2( sdVerticalCapsule( vec3(abs(p.x),p.y,p.z) - float3(s.x-.5,0,0), s.z, 1. ), 1. )
    );
}




float sdBox2D( float2 p, float2 b )
{
    float2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}
float2 primitive( float2 p, float bank )
{
    p = mul(rot(bank) , p);
    return min2(
        float2( sdBox2D( p, float2( 4, .5 )), 0. ),
        float2( min(
            length(p - float2(4.5,0)) - 1.,
            length(p + float2(4.5,0)) - 1.
        ), 1. )
    );

}
float2 opRevolution( float3 p, float radius, float bank )
{
    float2 q = float2( length(p.xz) - radius, p.y );
    return primitive(q, bank);
}
float2 opExtrusion( float3 p, float radius, float bank )
{
    p.x -= radius;
    float2 d = primitive(p.xy, bank);
    float2 w = float2( d.x, abs(p.z)); // -1);
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
    float2 d = p.x > 0. && p.z > 0. ? opRevolution( p, radius, bank ) : float2(10000.,0.); // sdObj0( p, s );
    float2 d1 = opExtrusion( p, radius, bank );
    float2 d2 = opExtrusion( p.zyx, radius, bank );
    return min2(d,min2(d1,d2));
}

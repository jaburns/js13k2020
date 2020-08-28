float2 track( float3 p )
{
return min2(opSmoothUnion2(sdObj0( mul(quat(0.383,0,0,0.924),p-float3(0.5,-1.42,64.26)), float3(2.29,0.5,3.109)),sdObj1( mul(quat(0,0,0,1),p-float3(0.5,0,-130.6)), float3(4,0.5,100),0.),2),min2(sdObj1( mul(quat(0,0,0,1),p-float3(0.5,0,-130.6)), float3(4,0.5,100),0.),min2(sdObj0( mul(quat(0.383,0,0,0.924),p-float3(0.5,-1.42,64.26)), float3(2.29,0.5,3.109)),sdObj1( mul(quat(0,0,0,1),p-float3(0.5,5.65,87.7)), float3(4,0.5,100),0.))));
}
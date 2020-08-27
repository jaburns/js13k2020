float track( float3 p )
{
return min(opSmoothUnion(sdObj0( mul(quat(0.347,0,0,0.938),p-float3(0,-0.95,17.21)), float3(2.622,0.25,2.197)),sdObj1( mul(quat(0,0,0,1),p-float3(0,-2.38,6.29)), float3(4,0.5,10.02)),2),min(sdObj1( mul(quat(0,0,0,1),p-float3(0,-2.38,6.29)), float3(4,0.5,10.02)),min(sdObj0( mul(quat(0.347,0,0,0.938),p-float3(0,-0.95,17.21)), float3(2.622,0.25,2.197)),sdObj1( mul(quat(0.057,-0.301,0.177,0.935),p-float3(7.8,2.6,34.5)), float3(4,0.5,10.02)))));
}
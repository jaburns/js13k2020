float track( float3 p )
{
return min(opSmoothUnion(sdObj1( mul(quat(0.018,-0.135,0.13,0.982),p-float3(3.09,1.56,36)), float3(4,0.5,10.02)),opSmoothUnion(sdObj0( mul(quat(0.313,0,0,0.95),p-float3(0.5,-2.22,15.58)), float3(2.29,0.5,5.093)),sdObj1( mul(quat(0,0,0,1),p-float3(0.5,-2.38,6.29)), float3(4,0.5,10.02)),2),2),min(sdObj1( mul(quat(0,0,0,1),p-float3(0.5,-2.38,6.29)), float3(4,0.5,10.02)),min(sdObj0( mul(quat(0.313,0,0,0.95),p-float3(0.5,-2.22,15.58)), float3(2.29,0.5,5.093)),sdObj1( mul(quat(0.018,-0.135,0.13,0.982),p-float3(3.09,1.56,36)), float3(4,0.5,10.02)))));
}
// Generated by track editor Unity project
const vec3 Xc0 = vec3(0.44,0.13,53.7);
const vec4 Xf0 = vec4(0,0,0,1);
const vec3 Xc1 = vec3(23.58,8.11,162.77);
const vec4 Xf1 = vec4(0.12,-0.468,0.199,0.853);
const vec3 Xc2 = vec3(65.47,7.93,166.48);
const vec4 Xf2 = vec4(0.07,-0.704,0.07,0.704);
const vec3 Xc3 = vec3(122.56,9.77,207.71);
const vec4 Xf3 = vec4(0,-0.277,0,0.961);
vec2 Xmap( vec3 p )
{
return min2(opSmoothUnion2(sdObj0( quat(0.313,0.,0.,0.95)*(p-vec3(0.5,-2.73,62.27)), vec3(2.29,0.5,5.093)),sdObj1( quat(0.,0.,0.,1.)*(p-vec3(0.5,0.17,-30.13)), vec3(4,0.5,50),0.),2.),min2(sdObj1( quat(0.,0.,0.,1.)*(p-vec3(0.5,0.17,-30.13)), vec3(4,0.5,50),0.),min2(sdObj1( quat(0.,0.707,0.,0.707)*(p-vec3(80.5,8.2,166.31)), vec3(4,0.5,20),-80.),min2(sdObj0( quat(0.313,0.,0.,0.95)*(p-vec3(0.5,-2.73,62.27)), vec3(2.29,0.5,5.093)),min2(sdObj2( quat(0.,0.,0.,1.)*(p-vec3(0.5,8.2,126.32)), vec3(4,0.5,20),-40.,-0.5),min2(sdObj0( quat(0.109,-0.195,-0.44,0.87)*(p-vec3(19.63,-2.73,93.83)), vec3(5,5,5)),min2(sdObj1( quat(0.,0.,0.,1.)*(p-vec3(0.5,8.2,86.35)), vec3(4,0.5,20),80.),min2(sdObj0( quat(-0.25,-0.551,-0.688,0.401)*(p-vec3(-71,-9.6,127.4)), vec3(18.917,18.917,18.917)),min2(sdObj0( quat(0.119,0.,0.,0.993)*(p-vec3(0.5,-2.19,-39.91)), vec3(3.549,0.5,5.093)),sdObj0( quat(0.,0.,0.,1.)*(p-vec3(115.1,-9.6,179.6)), vec3(20,20,20)))))))))));
}
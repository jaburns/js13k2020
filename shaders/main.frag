uniform float u_time;
uniform vec2 u_resolution;

const float i_EPS = 0.05;
const float i_PRECISION = .8;
const int i_ITERATIONS = 100;
const float i_PI = 3.1416;

const vec3 i_COLORA = (vec3(151, 203, 169) / 255.);
const vec3 i_COLORC = (.3*vec3(102, 139, 164) / 255.);
const vec3 i_COLORD = (.1*vec3(102, 139, 164) / 255.);

mat2 rot( float t )
{
    return mat2(cos(t), sin(t), -sin(t), cos(t));
}

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float map( vec3 p )
{
    return
        min(sdBox( (mat4(-0.08023274,0,0.9967762,0,0,1,0,0,-0.9967762,0,-0.08023274,0,9.711304,7.7,-0.07143568,1)*vec4(p,1)).xyz, vec3(21.003,1.29165,19.435) ),min(sdBox( (mat4(0.7995832,0.1724591,-0.5752606,0,-0.5640908,0.5443653,-0.6208608,0,0.2060788,0.8209289,0.5325479,0,-6.869841,-4.359734,-16.26464,1)*vec4(p,1)).xyz, vec3(5.886339,5.886337,5.88634) ),min(sdBox( (mat4(0.02408681,0.762437,0.6466139,0,-0.5640909,0.5443654,-0.6208605,0,-0.8253611,-0.3497945,0.4431958,0,10.1649,5.944276,-14.78282,1)*vec4(p,1)).xyz, vec3(5.886339,5.886336,5.88634) ),min(sdBox( (mat4(-0.07522722,-0.02789542,0.996776,0,-0.3476813,0.9376128,-2.959376E-08,0,-0.93459,-0.3465604,-0.08023273,0,8.304553,13.2649,0.7672316,1)*vec4(p,1)).xyz, vec3(4.62835,4.628349,4.628351) ),min(sdBox( (mat4(0.1062972,0.911819,0.3965941,0,-0.3906579,0.4050781,-0.8266184,0,-0.9143779,-0.06706548,0.399268,0,5.939402,-18.15867,-16.09685,1)*vec4(p,1)).xyz, vec3(19.35391,15.39944,4.628351) ),min(sdBox( (mat4(-0.3313271,-0.1861091,0.9249789,0,0.3532871,0.8845636,0.3045247,0,-0.8748775,0.4276803,-0.22733,0,2.176739,8.482846,4.194633,1)*vec4(p,1)).xyz, vec3(9.822285,4.628349,21.50193) ),sdBox( (mat4(-0.07522722,-0.02789542,0.996776,0,-0.3476813,0.9376128,-2.959376E-08,0,-0.93459,-0.3465604,-0.08023273,0,16.86339,7.383733,0.7569989,1)*vec4(p,1)).xyz, vec3(4.62835,4.628349,4.628351) )))))))
;
}

struct March
{
    vec3 pos;
    float dist;
    float ao;
};

March march( vec3 ro, vec3 rd )
{
    float dist;
	float totalDist = 0.0;
    
    int j = 0;
    for( int i = 0; i < i_ITERATIONS; ++i )
    {
        j = i;
        dist = map( ro );
        if( dist < i_EPS || totalDist > 200. ) break;
        totalDist += i_PRECISION * dist;
        ro += i_PRECISION * rd * dist;
    }
    
    return March( ro, dist < i_EPS ? totalDist : -1.0, float(j) / 90. );
}

vec3 getNorm(vec3 p)
{
    vec2 e = vec2(0.001, 0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)));
}


void main()
{
    vec2 uv = (gl_FragCoord.xy - .5*u_resolution)/u_resolution.y;
    vec3 ro = vec3(0,0,-5);
    vec3 rd = normalize(vec3(uv, .8));
    
    March m = march( ro, rd );
    
    float lightness = 0.;
    vec3 color = i_COLORC;
    
    if( m.dist >= 0.0 ) {
        float fog = exp( -.02*m.dist );
        vec3 norm = getNorm( m.pos );
        lightness = fog * (1. - m.ao);
        lightness *= clamp(dot(vec3(1,1,-1), norm),0.2,1.);
        color = i_COLORA;
        vec3 shadow = mix(i_COLORD, i_COLORC, 1. - fog);
        color = mix( shadow, color, lightness );        
    }

    gl_FragColor = vec4(color,1);
}
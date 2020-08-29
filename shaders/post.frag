uniform sampler2D u_tex;
uniform sampler2D u_canvas;
uniform vec2 u_resolution;
uniform vec2 u_time;

float easeOutCubic(float x) { float x1 = (1. - x); return 1. - x1*x1*x1; }
float sdBox( in vec2 p, in vec2 b ) { vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }

vec4 getImage( vec2 uv )
{
    if( u_time.x == 0. ) return vec4(0,0.05,0.05,1);

    
    vec4 sample =   texture2D( u_tex, uv + 1./vec2(-s_fullWidth.,-s_fullHeight.) );
    vec4 sampleU =  texture2D( u_tex, uv + 1./vec2(-s_fullWidth.,s_fullHeight.) );
    vec4 sampleR =  texture2D( u_tex, uv + 1./vec2(s_fullWidth.,-s_fullHeight.) );
    vec4 sampleUR = texture2D( u_tex, uv + 1./vec2(s_fullWidth.,s_fullHeight.) );

    //return vec4(sample.w / 6.);

    float d0 = sample.w - sampleUR.w;
    float d1 = sampleR.w - sampleU.w;

    float edgeDepth = sqrt(d0*d0 + d1*d1) * 100.;
    edgeDepth = edgeDepth > 50. ? 1. : 0.;

    vec3 n0 = sample.xyz - sampleUR.xyz;
    vec3 n1 = sampleR.xyz - sampleU.xyz;
    float edgeNormal = sqrt(dot( n0, n0 ) + dot( n1, n1 ));
    //edgeNormal = edgeNormal > .9 ? 1. : 0.;

    float val = max( edgeNormal, edgeDepth );




    vec2 uv1 = uv;
    float hide = .7;
    uv1.y = 1. - uv1.y;
    if( uv1.y < .7 ) {
        uv1.x += .5*uv1.y - .27;
    } else {
        hide *= floor(2.*fract(u_time.y));
    }
    vec4 canvas = texture2D( u_canvas, uv1 );




    vec4 outColor = vec4( val,0,val,0 ) + hide*canvas;




    float t = u_time.y - u_time.x;
    if( t < 1. )
    {
        vec2 uv2 = uv - .5;
        if( t < .25 )
        {
            t = easeOutCubic( 4.*t );
            if( sdBox( uv2, vec2(t, .02*t)) < 0. )
                return vec4(1);
        }
        else if( t < 1. )
        {
            t = easeOutCubic( 1.3*(t-.25) );
            if( sdBox( uv2, vec2(10., t)) < 0. )
                return mix(vec4(1), outColor, t);
        }
        return vec4(0,0.05,.05,1);
    }


    return outColor;
}

// ---------------------------------------------------------------------------------
// MattiasCRT effect by Mattias from https://www.shadertoy.com/view/Ms23DR
// ---------------------------------------------------------------------------------

void m0()
{
    vec2 uv = gl_FragCoord.xy / u_resolution;
//         gl_FragColor = getImage( uv );
//         return;

    // curve
    uv = (uv - 0.5) * 2.0;
    uv *= 1.1;	
    uv.x *= 1.0 + pow((abs(uv.y) / 5.0), 2.0);
    uv.y *= 1.0 + pow((abs(uv.x) / 4.0), 2.0);
    uv  = (uv / 2.0) + 0.5;
    uv =  uv *0.92 + 0.04;

    vec3 col;
    float x =  sin(0.3*u_time.y+uv.y*21.0)*sin(0.7*u_time.y+uv.y*29.0)*sin(0.3+0.33*u_time.y+uv.y*31.0)*0.0017;

    col.r = getImage(vec2(x+uv.x+0.001,uv.y+0.001)).x+0.05;
    col.g = getImage(vec2(x+uv.x+0.000,uv.y-0.002)).y+0.05;
    col.b = getImage(vec2(x+uv.x-0.002,uv.y+0.000)).z+0.05;
    col.r += 0.08*getImage(0.75*vec2(x+0.025, -0.027)+vec2(uv.x+0.001,uv.y+0.001)).x;
    col.g += 0.05*getImage(0.75*vec2(x+-0.022, -0.02)+vec2(uv.x+0.000,uv.y-0.002)).y;
    col.b += 0.08*getImage(0.75*vec2(x+-0.02, -0.018)+vec2(uv.x-0.002,uv.y+0.000)).z;

    col = clamp(col*0.6+0.4*col*col*1.0,0.0,1.0);
    float vig = (0.0 + 1.0*16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y));
    col *= vec3(pow(vig,0.3));
    col *= vec3(0.95,1.05,0.95);
    col *= 2.8;

    //float scans = clamp( 0.35+0.35*sin(0.0*u_time.y+uv.y*1200.), 0.0, 1.0);
    //float scans = clamp( 0.35+0.35*sin(3.5*u_time.y+uv.y*u_resolution.y*1.5), 0.0, 1.0);
    float scans = clamp( 0.35+0.35*sin(3.5*u_time.y+uv.y*u_resolution.y*1.1), 0.0, 1.0);
    float s = pow(scans,1.7);
    col = col*vec3( 0.4+0.7*s) ;

    col *= 1.0+0.01*sin(110.0*u_time.y);
    if (uv.x < 0.0 || uv.x > 1.0) col *= 0.0;
    if (uv.y < 0.0 || uv.y > 1.0) col *= 0.0;
    
    col*=1.0-0.65*vec3(clamp((mod(gl_FragCoord.x, 2.0)-1.0)*2.0,0.0,1.0));
    gl_FragColor = vec4(col,1.0);
}

/*
    vec2 uv1 = gl_FragCoord.xy / u_resolution;
    uv1.y = 1. - uv1.y;
    if( uv1.y < .7 )
        uv1.x += .5*uv1.y - .27;
    vec4 canvas = texture2D( u_canvas, uv1 );
*/

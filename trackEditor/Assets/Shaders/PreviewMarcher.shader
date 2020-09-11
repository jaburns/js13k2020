Shader "Unlit/PreviewMarcher"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 100

        Pass
        {
        CGPROGRAM

            #pragma vertex vert
            #pragma fragment frag

            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 uv : TEXCOORD0;
            };

            sampler2D _MainTex;
            float4 _MainTex_ST;
            float2 g_traceBits;

            v2f vert( appdata v )
            {
                v2f o;
                o.vertex = UnityObjectToClipPos( v.vertex );
                float4 sp = ComputeScreenPos( o.vertex );
                o.uv = sp.xy / sp.w - .5;
                o.uv.x *= _ScreenParams.x / _ScreenParams.y;
                o.uv *= 2;
                return o;
            }

            float3x3 transpose_hlsl_only( float3x3 m )
            {
                return transpose( m );
            }
            float2x2 transpose_hlsl_only( float2x2 m )
            {
                return transpose( m );
            }
            float mod( float x, float y )
            {
                return x % y;
            }

            #include "trackData.gen.cginc"

            float2 map( float3 p )
            {
                float2 world = min2( Xm( p ), float2( p.y, -1. ));
                world = min2( world, sdCheckpoint( p, Xc0, Xf0, 0. ) );
                world = min2( world, sdCheckpoint( p, Xc1, Xf1, 0. ) );
                world = min2( world, sdCheckpoint( p, Xc2, Xf2, 0. ) );
                world = min2( world, sdCheckpoint( p, Xc3, Xf3, 0. ) );
                return world;
            }

            float3 getNorm(float3 p)
            {
                g_traceBits = float2(i_BITS_ALL,i_BITS_ALL);
                float2 e = float2(0.001, 0);
                return normalize(float3(
                    map(p + e.xyy).x - map(p - e.xyy).x,
                    map(p + e.yxy).x - map(p - e.yxy).x,
                    map(p + e.yyx).x - map(p - e.yyx).x));
            }



            float4 frag( v2f i ) : SV_Target
            {
                float3 ro = _WorldSpaceCameraPos;
                float3 f = mul((float3x3)unity_CameraToWorld, float3(0,0,1));
                float3 r = normalize(cross(float3(0,1,0), f));
                float3 u = cross(f, r);
                float3 c = ro + f;
                float3 ii = c + i.uv.x * r + i.uv.y * u;
                float3 rd = normalize(ii - ro);

                g_traceBits = float2(0,0);

                float traceDist = 10000.;
                {
                    float hit;
                    hit = traceBox( mul(quat(Xf0),ro-Xc0), mul(quat(Xf0),rd), float3(5,5,.5) );
                    if( hit >= 0. ) { g_traceBits.x += i_BIT2; if( hit < traceDist ) traceDist = hit; }
                    hit = traceBox( mul(quat(Xf1),ro-Xc1), mul(quat(Xf1),rd), float3(5,5,.5) );
                    if( hit >= 0. ) { g_traceBits.x += i_BIT3; if( hit < traceDist ) traceDist = hit; }
                    hit = traceBox( mul(quat(Xf2),ro-Xc2), mul(quat(Xf2),rd), float3(5,5,.5) );
                    if( hit >= 0. ) { g_traceBits.x += i_BIT4; if( hit < traceDist ) traceDist = hit; }
                    hit = traceBox( mul(quat(Xf3),ro-Xc3), mul(quat(Xf3),rd), float3(5,5,.5) );
                    if( hit >= 0. ) { g_traceBits.x += i_BIT5; if( hit < traceDist ) traceDist = hit; }
                }

                float traceD = Xt( ro, rd, traceDist );
                float base = 0.;

                if( traceD >= 0. )
                {
                    base = .1;
                    ro += rd * traceD;
                    float2 distMat;
                    float totalDist = traceD > 0. ? traceD : 0.;

                    for (int i = 0; i < 100; ++i)
                    {
                        distMat = map(ro);
                        if (distMat.x < .001 || totalDist > 200.) break;        
                        totalDist += distMat.x;
                        ro += rd * distMat.x;
                    }

                    if( distMat.x < .001 && distMat.y > 0. )
                    {
                        float3 norm = getNorm( ro );
                        float4 col = float4( .5 + .5*norm, 1 );
                        col += frac(distMat.y) > .4 ? .2 : 0.;
                        return col;
                    }
                }

                return float4( base,base,base,0 );
            }

        ENDCG
        }
    }
}

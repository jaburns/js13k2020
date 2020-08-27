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

            #include "SDFDefs.cginc"
            #include "MapDefs.cginc"

            float2 map( float3 p )
            {
                return track( p );
            }

            #define ITERATIONS  100
            #define EPSILON      0.0001
            #define MAX_DIST    100.
            #define PI 3.14159265358979

            struct MarchResult
            {
                float3 pos;
                float dist;
                float mat;
                float ao;
            };

            MarchResult march(float3 ro, float3 rd)
            {
                float totalDist = 0.0;
                float2 distMat;
                
                int i;
                for (i = 0; i < ITERATIONS; ++i) {
                    distMat = map(ro);
                    if (distMat.x < EPSILON || totalDist > MAX_DIST) break;        
                    totalDist += distMat.x;
                    ro += rd * distMat.x;
                }
                
                MarchResult ret;
                ret.pos = ro;
                ret.dist = distMat.x < EPSILON ? totalDist : -1.;
                ret.mat = distMat.y;
                ret.ao = 1. - float(i)/100.;
                return ret;
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

                MarchResult m = march(ro, rd);

                float3 LIGHT = float3(255., 165., 0.) / 255.;
                
                float vis = 0.;
                if (m.dist >= 0.) {
                    vis = exp(-.05 * m.dist) * m.ao;
                    if( m.mat > 0. ) LIGHT = 1. - LIGHT;
                }
                
                float3 DARK = lerp(float3(97., 8., 52.) / 255., float3(0,0,0), .2);
                
                return float4(lerp(DARK, LIGHT, vis), 0);
            }

        ENDCG
        }
    }
}

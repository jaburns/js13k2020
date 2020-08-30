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
            float mod( float x, float y )
            {
                return x % y;
            }

            #include "trackData.gen.cginc"

            float2 map( float3 p )
            {
                return min2( t00( p ), float2( p.y, -1. ));
            }

            float3 getNorm(float3 p)
            {
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

                float totalDist = 0.0;
                float2 distMat;
                for (int i = 0; i < 100; ++i) {
                    distMat = map(ro);
                    if (distMat.x < .001 || totalDist > 200.) break;        
                    totalDist += distMat.x;
                    ro += rd * distMat.x;
                }

                if( distMat.x < .001 && distMat.y >= 0. )
                {
                    float3 norm = getNorm( ro );
                    return float4( .5 + .5*norm, 1 );
                }

                return float4( 0,0,0,0 );
            }

        ENDCG
        }
    }
}

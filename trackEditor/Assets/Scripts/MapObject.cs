using UnityEngine;
using System.Collections.Generic;
using System.Linq;

public class MapObject : MonoBehaviour
{
    public enum Kind
    {
        Box = 0,
        StraightTrack = 1,
        CurvedTrack = 2,
    }

    public Kind kind;
    public List<float> parames;

    void OnDrawGizmos()
    {
        Gizmos.matrix = transform.localToWorldMatrix;
        Gizmos.DrawCube( Vector3.forward*.5f, Vector3.one );
    }

    public string WriteShaderCall( bool glsl )
    {
        var fn = "sdObj" + (int)kind;
        var b = GetTracingBounds( true );

        var result = string.Format(
            glsl
                ? fn+"( quat({0},{1},{2},{3})*(p-vec3({4},{5},{6})), vec3({7},{8},{9}) "
                : fn+"( mul(quat({0},{1},{2},{3}),p-float3({4},{5},{6})), float3({7},{8},{9}) ",
            Utils.SmallNum( b.invRotation.x, glsl ), Utils.SmallNum( b.invRotation.y, glsl ), Utils.SmallNum( b.invRotation.z, glsl ), Utils.SmallNum( b.invRotation.w, glsl ),
            Utils.SmallNum( b.position.x ), Utils.SmallNum( b.position.y ), Utils.SmallNum( b.position.z ),
            Utils.SmallNum( b.extents.x ), Utils.SmallNum( b.extents.y ), Utils.SmallNum( b.extents.z )
        );

        return result + string.Join( "", parames.Select( x => ","+Utils.SmallNum(x,true) )) + " )";
    }

    public string WriteShaderLine( bool glsl )
    {
        return "d = min2( d, " + WriteShaderCall( glsl ) + " );\n";
    }

    public TracingBounds GetTracingBounds( bool march = false )
    {
        var position = transform.position;
        var extents = .5f * transform.localScale;

        if( !march )
        {
            if( kind == Kind.StraightTrack )
            {
                extents += new Vector3( 1, 1, 1 );

                if( Mathf.Abs(parames[0]) > 1 )
                    extents += .5f * Vector3.up * (transform.localScale.x - transform.localScale.y);
            }
            else if( kind == Kind.CurvedTrack )
            {
                extents = new Vector3(
                    .5f * Mathf.Abs(parames[0]),
                    .5f * transform.localScale.x,
                    .5f * Mathf.Abs(parames[0])
                );
                extents += new Vector3( 3, 1, 3 );
                position += transform.rotation
                    * ( parames[0] < 0 ? Vector3.right : Vector3.left )
                    * ( 2 + .5f * Mathf.Abs(parames[0]) - .5f*transform.localScale.x);
            }
        }

        // TODO optimization: curved track only uses extends.x

        return new TracingBounds
        {
            position = position,
            invRotation = Quaternion.Inverse( transform.rotation ),
            extents = extents
        };
    }
}
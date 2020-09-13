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
        Shrinker = 3,
        Bumper = 4,
    }

    public Kind kind;

    [HideInInspector]
    public List<float> parames;

    void OnDrawGizmos()
    {
        Gizmos.matrix = transform.localToWorldMatrix;
        Gizmos.DrawCube( Vector3.forward*.5f, Vector3.one );
    }

    public string WriteShaderCall()
    {
        var fn = "sdObj" + (int)kind;
        var b = GetTracingBounds( true );

        var result = string.Format(
            fn+"( p, {0},{1},{2},{3},{4},{5},{6} ",
            Utils.SmallNum( b.invRotation.x, true ), Utils.SmallNum( b.invRotation.y, true ), Utils.SmallNum( b.invRotation.z, true ), Utils.SmallNum( b.invRotation.w, true ),
            Utils.SmallNum( b.position.x, true ), Utils.SmallNum( b.position.y, true ), Utils.SmallNum( b.position.z, true )
        );

        var pars = parames.Select( x => x ).ToList();

        switch( kind )
        {
            case Kind.Box:
                pars.Insert( 0, b.extents.z );
                pars.Insert( 0, b.extents.y );
                pars.Insert( 0, b.extents.x );
                break;

            case Kind.StraightTrack:
                pars.Insert( 0, b.extents.z );
                pars.Insert( 0, b.extents.x );
                break;

            case Kind.CurvedTrack:
                pars.Insert( 0, b.extents.x );
                break;

            case Kind.Shrinker:
                pars.Insert( 0, b.extents.z );
                pars.Insert( 0, b.extents.x );
                break;

            case Kind.Bumper:
                pars.Insert( 0, b.extents.x );
                pars.Insert( 0, b.extents.z );
                break;
        }

        return result + string.Join( "", pars.Select( x => ","+Utils.SmallNum(x,true) )) + " )";
    }

    public string WriteShaderLine()
    {
        return "d = min2( d, " + WriteShaderCall() + " );\n";
    }

    public TracingBounds GetTracingBounds( bool march = false )
    {
        var position = transform.position;
        var extents = .5f * transform.localScale;

        if( !march )
        {
            if( kind == Kind.Shrinker )
            {
                extents.x = Mathf.Max( .5f * transform.localScale.x, parames[0] );
                extents += new Vector3( 1, 1, 1 );
            }

            if( kind == Kind.StraightTrack )
            {
                extents += new Vector3( 1, 1, 1 );

                if( Mathf.Abs(parames[0]) > 1 )
                    extents += .5f * Vector3.up * (transform.localScale.x - transform.localScale.y);
            }
            else if( kind == Kind.CurvedTrack )
            {
                var r = Mathf.Abs(parames[0]);
                var d = .5f * transform.localScale.x + 1f;

                extents = new Vector3(
                    (r + d) / 2f,
                    d,
                    (r + d) / 2f
                );
                position += transform.rotation
                    * ( parames[0] < 0 ? Vector3.left : Vector3.right )
                    * ( -r + .5f*(r + d));

                extents += new Vector3( 1, 1, 1 );
            }
            else if( kind == Kind.Bumper )
            {
                extents.x *= 2f;
                extents.y *= 2f;
                extents.z += extents.x/2;
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
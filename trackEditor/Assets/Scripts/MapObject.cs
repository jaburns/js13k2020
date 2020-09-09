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
        var invQuat = Quaternion.Inverse( transform.rotation );
        var fn = "sdObj" + (int)kind;

        var result = string.Format(
            glsl
                ? fn+"( quat({0},{1},{2},{3})*(p-vec3({4},{5},{6})), vec3({7},{8},{9}) "
                : fn+"( mul(quat({0},{1},{2},{3}),p-float3({4},{5},{6})), float3({7},{8},{9}) ",
            Utils.SmallNum( invQuat.x, glsl ), Utils.SmallNum( invQuat.y, glsl ), Utils.SmallNum( invQuat.z, glsl ), Utils.SmallNum( invQuat.w, glsl ),
            Utils.SmallNum( transform.position.x ), Utils.SmallNum( transform.position.y ), Utils.SmallNum( transform.position.z ),
            Utils.SmallNum( .5f*transform.localScale.x ), Utils.SmallNum( .5f*transform.localScale.y ), Utils.SmallNum( .5f*transform.localScale.z )
        );

        return result + string.Join( "", parames.Select( x => ","+Utils.SmallNum(x,true) )) + " )";
    }

    public string WriteShaderLine( bool glsl )
    {
        return "d = min2( d, " + WriteShaderCall( glsl ) + " );\n";
    }
}
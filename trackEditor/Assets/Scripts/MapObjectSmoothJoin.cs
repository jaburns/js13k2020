using UnityEngine;
using System.Linq;

public class MapObjectSmoothJoin : MonoBehaviour
{
    public float k;
    public Vector3 boundsScale;
    public bool actuallySubtraction;
    public float innerMaterial;

    public string WriteShaderLine( bool glsl )
    {
        string result = "{\n";

        var children = GetComponentsInChildren<MapObject>();
        if( children.Length < 2 )
            throw new System.Exception("Cant join less than 2");

        if( !actuallySubtraction )
        {
            var lines = children.Select( x => x.WriteShaderCall()).ToArray();
            result += string.Format( "vec2 d1 = opSmoothUnion2({0},{1},"+Utils.SmallNum(k,true)+")", lines[0], lines[1] ) + ";\n";
            for( var i = 2; i < lines.Length; ++i )
                result += string.Format( "d1 = opSmoothUnion2(d1,{0},"+Utils.SmallNum(k,true)+")", lines[i] ) + ";\n";
        }
        else
        {
            var lines = children.Select( x => x.WriteShaderCall()).ToArray();
            result += string.Format( "vec2 d1 = opSubtract2({0},{1},{2});\n", lines[0], lines[1], Utils.SmallNum(innerMaterial,true));
            for( var i = 2; i < lines.Length; ++i )
                result += string.Format( "d1 = opSubtract2(d1,{0},{2});", lines[1], Utils.SmallNum(innerMaterial,true));
        }

        result += "d = min2( d, d1 );\n}\n";

        if( !glsl )
            result = result.Replace( "vec2", "float2" );

        return result;
    }

    void OnDrawGizmos()
    {
        Gizmos.color = Color.red;
        Gizmos.matrix = Matrix4x4.TRS( transform.position, transform.rotation, boundsScale );
        Gizmos.DrawWireCube( new Vector3( 0, 0, .5f ), Vector3.one );
    }

    public TracingBounds GetTracingBounds()
    {
        return new TracingBounds
        {
            position = transform.position,
            invRotation = Quaternion.Inverse( transform.rotation ),
            extents = boundsScale * .5f
        };
    }
}
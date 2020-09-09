using UnityEngine;
using System.Linq;

public class MapObjectSmoothJoin : MonoBehaviour
{
    public float k;

    public string WriteShaderLine( bool glsl )
    {
        string result = "{\n";

        var children = GetComponentsInChildren<MapObject>();
        if( children.Length < 2 )
            throw new System.Exception("Cant join less than 2");

        var lines = children.Select( x => x.WriteShaderCall( glsl )).ToArray();
        result += string.Format( "vec2 d1 = opSmoothUnion2({0},{1},"+Utils.SmallNum(k,true)+")", lines[0], lines[1] ) + ";\n";

        for( var i = 2; i < lines.Length; ++i )
            result += string.Format( "d1 = opSmoothUnion2(d1,{0},"+Utils.SmallNum(k,true)+")", lines[i] ) + ";\n";

        result += "d = min2( d, d1 );\n}\n";

        if( !glsl )
            result = result.Replace( "vec2", "float2" );

        return result;
    }
}
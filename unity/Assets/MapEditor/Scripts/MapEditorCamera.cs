using UnityEngine;
using UnityEditor;
using System.IO;
using System.Linq;
using System.Collections.Generic;

[ExecuteInEditMode]
public class MapEditorCamera : MonoBehaviour
{
    static Camera thisCam;

    [MenuItem("js13k/Update %#e")]
    static void triggerUpdate()
    {
        var cam = SceneView.lastActiveSceneView.camera;

        thisCam.transform.position = cam.transform.position;
        thisCam.transform.rotation = cam.transform.rotation;
        thisCam.transform.localScale = cam.transform.localScale;
        thisCam.fieldOfView = cam.fieldOfView;

        File.WriteAllText(Application.dataPath + "/MapEditor/Shaders/MapDefs.cginc", GenShader( false ));
        File.WriteAllText(Application.dataPath + "/MapEditor/Shaders/MapDefs.glsl.txt", GenShader( true ));
        AssetDatabase.Refresh();
    }

    void Update()
    {
        thisCam = GetComponent<Camera>();
    }

    class MapObjectSDF
    {
        public Matrix4x4 invTransform;
        public Vector3 pos;
        public Quaternion rot;
        public Vector3 dims;
        public string fn;
    }

    class SmoothJoinGroup
    {
        public float k;
        public List<MapObjectSDF> objs;
    }

    static string joinCalls( string template, List<string> calls )
    {
        var result = calls[0];
        calls.RemoveAt(0);

        while( calls.Count > 0 )
        {
            result = string.Format(template, calls[0], result );
            calls.RemoveAt(0);
        }

        return result;
    }

    static string smallNum( float x, bool keepPeriod = false )
    {
        var d = System.Convert.ToDecimal( x );
        var result = System.Math.Round( d, 3 ).ToString();
        while( result.Contains(".") && result.EndsWith("0") || result.EndsWith(".") )
            result = result.Substring( 0, result.Length - 1 );
        result = result.Length == 0 ? "0" : result;
        if( keepPeriod && !result.Contains(".") ) result += ".";
        return result;
    }

    static string genBoxShader( MapObjectSDF obj, bool glsl ) // string fn, Matrix4x4 m, Vector3 dims, bool glsl )
    {
        var invQuat = Quaternion.Inverse( obj.rot );

        return string.Format(
            glsl
                ? obj.fn+"( quat({0},{1},{2},{3})*(p-vec3({4},{5},{6})), vec3({7},{8},{9}))"
                : obj.fn+"( mul(quat({0},{1},{2},{3}),p-float3({4},{5},{6})), float3({7},{8},{9}))",
                smallNum(invQuat.x, glsl), smallNum(invQuat.y, glsl), smallNum(invQuat.z, glsl), smallNum(invQuat.w, glsl),
                smallNum(obj.pos.x), smallNum(obj.pos.y), smallNum(obj.pos.z),
                smallNum(obj.dims.x), smallNum(obj.dims.y), smallNum(obj.dims.z)
        );

    //    var dims = obj.dims;
    //    var m = obj.invTransform;

    //    if( glsl )
    //        m = m.transpose;

    //    return string.Format(
    //        glsl
    //            ? obj.fn+"( (mat4({0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},{11},{12},{13},{14},{15})*vec4(p,1)).xyz, vec3({16},{17},{18}) )"
    //            : obj.fn+"( mul(float4x4({0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},{11},{12},{13},{14},{15}),float4(p,1)).xyz, float3({16},{17},{18}) )",
    //        smallNum(m.m00), smallNum(m.m01), smallNum(m.m02), smallNum(m.m03),
    //        smallNum(m.m10), smallNum(m.m11), smallNum(m.m12), smallNum(m.m13),
    //        smallNum(m.m20), smallNum(m.m21), smallNum(m.m22), smallNum(m.m23),
    //        smallNum(m.m30), smallNum(m.m31), smallNum(m.m32), smallNum(m.m33),
    //        smallNum(dims.x), smallNum(dims.y), smallNum(dims.z)
    //    );
    }

    static public string GenShader( bool glsl )
    {
        var calls = new List<string>();

        var groupedObjects = new List<GameObject>();

        var smoothJoinGroups = GameObject.FindObjectsOfType<MapObjectSmoothJoin>().Select( y =>
        {
            groupedObjects.Add( y.gameObject );

            return new SmoothJoinGroup {
                k = y.k,
                objs = y.GetComponentsInChildren<MapObject>().Select( x => new MapObjectSDF {
                    invTransform = Matrix4x4.TRS( x.transform.position, x.transform.rotation, Vector3.one ).inverse,
                    pos = x.transform.position,
                    rot = x.transform.rotation,
                    dims = .5f * x.transform.localScale,
                    fn = "sdObj" + (int)x.kind
                }).ToList()
            };
        });

        var items = GameObject.FindObjectsOfType<MapObject>().Where( x => !groupedObjects.Contains( x.gameObject )).Select( x => new MapObjectSDF {
            invTransform = Matrix4x4.TRS( x.transform.position, x.transform.rotation, Vector3.one ).inverse,
            pos = x.transform.position,
            rot = x.transform.rotation,
            dims = .5f * x.transform.localScale,
            fn = "sdObj" + (int)x.kind
        }).ToArray();

        var smoothCalls = smoothJoinGroups.Select(
            x => joinCalls(
                "opSmoothUnion({0},{1},"+smallNum(x.k, glsl)+")",
                x.objs.Select( y => genBoxShader( y, glsl )).ToList()
            )
        ).ToList();

        return "float track( "+(glsl ? "vec3" : "float3")+" p )\n" +
        "{\n" +
            "return " + joinCalls( "min({0},{1})", items.Select( x => genBoxShader( x, glsl )).Concat(smoothCalls).ToList() ) + ";\n" +
        "}";
    }
}
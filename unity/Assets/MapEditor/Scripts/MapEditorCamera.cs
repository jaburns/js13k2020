﻿using UnityEngine;
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

    class SmoothJoinGroup
    {
        public float k;
        public List<MapObject> objs;
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

    static string addParams( string call, List<float> paramList )
    {
        paramList = paramList.Select(x => x).ToList();
        while( paramList.Count > 0 )
        {
            call += "," + smallNum( paramList[0], true );
            paramList.RemoveAt(0);
        }
        return call + ")";
    }

    static string genBoxShader( MapObject obj, bool glsl ) // string fn, Matrix4x4 m, Vector3 dims, bool glsl )
    {
        var invQuat = Quaternion.Inverse( obj.transform.rotation );
        var fn = obj.GetFn();

        var call = string.Format(
            glsl
                ? fn+"( quat({0},{1},{2},{3})*(p-vec3({4},{5},{6})), vec3({7},{8},{9})"
                : fn+"( mul(quat({0},{1},{2},{3}),p-float3({4},{5},{6})), float3({7},{8},{9})",
                smallNum(invQuat.x, glsl), smallNum(invQuat.y, glsl), smallNum(invQuat.z, glsl), smallNum(invQuat.w, glsl),
                smallNum(obj.transform.position.x), smallNum(obj.transform.position.y), smallNum(obj.transform.position.z),
                smallNum(.5f*obj.transform.localScale.x), smallNum(.5f*obj.transform.localScale.y), smallNum(.5f*obj.transform.localScale.z));

        return addParams( call, obj.parames );
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
                objs = y.GetComponentsInChildren<MapObject>().ToList(),
            };
        });

        var items = GameObject.FindObjectsOfType<MapObject>().Where( x => !groupedObjects.Contains( x.gameObject )).ToArray();

        var smoothCalls = smoothJoinGroups.Select(
            x => joinCalls(
                "opSmoothUnion2({0},{1},"+smallNum(x.k, glsl)+")",
                x.objs.Select( y => genBoxShader( y, glsl )).ToList()
            )
        ).ToList();

        return (glsl ? "vec2" : "float2") +" track( "+(glsl ? "vec3" : "float3")+" p )\n" +
        "{\n" +
            "return " + joinCalls( "min2({0},{1})", items.Select( x => genBoxShader( x, glsl )).Concat(smoothCalls).ToList() ) + ";\n" +
        "}";
    }
}
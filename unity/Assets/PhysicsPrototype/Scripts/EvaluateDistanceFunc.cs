using System.Collections.Generic;
using System.Linq;
using UnityEngine;

public class EvaluateDistanceFunc
{
    class BoxSDF
    {
        public Matrix4x4 invTransform;
        public Vector3 dims;
    }

    static BoxSDF[] boxes;

    static public void Load()
    {
        boxes = GameObject.FindObjectsOfType<BoxCollider>().Select( x => new BoxSDF {
            invTransform = Matrix4x4.TRS( x.transform.position, x.transform.rotation, Vector3.one ).inverse,
            dims = 0.5f * x.transform.localScale,
        })
        .ToArray();
    }

    static Vector3 max( Vector3 v, float a )
    {
        return new Vector3( Mathf.Max( v.x, a ), Mathf.Max( v.y, a ), Mathf.Max( v.z, a ));
    }
    static float sdBox( Vector3 p, Vector3 b )
    {
        var q = new Vector3( Mathf.Abs(p.x), Mathf.Abs(p.y), Mathf.Abs(p.z) ) - b;
        return max(q,0.0f).magnitude + Mathf.Min(Mathf.Max(q.x,Mathf.Max(q.y,q.z)),0.0f);
    }

    static public float Go( Vector3 p )
    {
        float dist = float.PositiveInfinity;

        //List<string> calls = new List<string>();

        foreach( var box in boxes )
        {
            //calls.Add(genGlsl( box.invTransform, box.dims ));
            float boxDist = sdBox( box.invTransform.MultiplyPoint( p ), box.dims );
            dist = Mathf.Min( boxDist, dist );
        }

        //Debug.Log(joinCalls( calls ));

        return dist;
    }

    static public Vector3 Normal( Vector3 p )
    {
        const float EPS = 0.001f;
        var xyy = new Vector3( EPS, 0, 0 );
        var yxy = new Vector3( 0, EPS, 0 );
        var yyx = new Vector3( 0, 0, EPS );

        return (new Vector3(
            Go( p + xyy ) - Go( p - xyy ),
            Go( p + yxy ) - Go( p - yxy ),
            Go( p + yyx ) - Go( p - yyx ))).normalized;
    }
}

using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class Truck3Controller : MonoBehaviour
{
    const float WHEEL_RADIUS = 1.5f;

    static bool first = false;

    public List<GameObject> wheels;
    public List<GameObject> fakeWheels;
    List<DistanceConstraint> constraints;
    List<Vector3> wheelVelocity;

    class DistanceConstraint
    {
        public GameObject a;
        public GameObject b;
        public readonly float dist;

        public DistanceConstraint( GameObject a, GameObject b )
        {
            this.a = a;
            this.b = b;
            this.dist = (a.transform.position - b.transform.position).magnitude;
        }

        public void StepSolve()
        {
            var aToB = b.transform.position - a.transform.position;
            var fixVec = 0.5f * (dist - aToB.magnitude) * aToB.normalized;
            a.transform.position -= fixVec;
            b.transform.position += fixVec;
        }
    }

    // Start is called before the first frame update
    void Start()
    {
        EvaluateDistanceFunc.Load();

        constraints = new List<DistanceConstraint> {
            (new DistanceConstraint( wheels[0], wheels[1] )),
            (new DistanceConstraint( wheels[0], wheels[2] )),
            (new DistanceConstraint( wheels[0], wheels[3] )),

            (new DistanceConstraint( wheels[1], wheels[2] )),
            (new DistanceConstraint( wheels[1], wheels[3] )),

            (new DistanceConstraint( wheels[2], wheels[3] )),
        };

        wheelVelocity = new List<Vector3> { Vector3.zero, Vector3.zero, Vector3.zero, Vector3.zero };
    }

    Vector3 LossyReflect( Vector3 v, Vector3 n, float bounce, float friction )
    {
        var randVec = Vector3.Dot( n, Vector3.up ) > 0.9f ? Vector3.right : Vector3.up;
        var tan_u = Vector3.Cross( n, randVec ).normalized;
        var tan_v = Vector3.Cross( n, tan_u );

        var v_n = -bounce * Vector3.Dot( v, n );
        var v_u = friction * Vector3.Dot( v, tan_u );
        var v_v = friction * Vector3.Dot( v, tan_v );

        return v_n*n + v_u*tan_u + v_v*tan_v;
    }
    
    void StepPosition( GameObject wheel, Vector3 posStep, ref Vector3 vel )
    {
        wheel.transform.position += posStep;

        var dist = EvaluateDistanceFunc.Go( wheel.transform.position );
        if( dist < WHEEL_RADIUS )
        {
            var normal = EvaluateDistanceFunc.Normal( wheel.transform.position );
            //wheel.transform.position += normal * (WHEEL_RADIUS - dist);
            vel += normal * (WHEEL_RADIUS - dist);
            vel = LossyReflect( vel, normal, -0.9f, 1.0f );
        }
    }

    void FixedUpdate()
    {
        first = true;
        for( int i = 0; i < 4; ++i )
        {
            wheelVelocity[i] += Physics.gravity * Time.fixedDeltaTime;
            Vector3 vel = wheelVelocity[i];
            StepPosition( wheels[i], wheelVelocity[i] * Time.fixedDeltaTime, ref vel );
            wheelVelocity[i] = vel;
            first = false;
        }

        for( int i = 0; i < 20; ++i )
        foreach( var c in constraints )
            c.StepSolve();

        var downVec = -Vector3.Cross( wheels[0].transform.position - wheels[1].transform.position, wheels[2].transform.position - wheels[1].transform.position ).normalized;
        for( var i = 0; i < 4; ++i )
        {
            fakeWheels[i].transform.position = wheels[i].transform.position + downVec;

            var dist = EvaluateDistanceFunc.Go( fakeWheels[i].transform.position );
            if( dist < 0.5f )
            {
                var normal = EvaluateDistanceFunc.Normal( fakeWheels[i].transform.position );
                fakeWheels[i].transform.position += normal * (0.5f - dist);
            }
        }
    }
}

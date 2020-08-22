using System.Linq;
using System.Collections.Generic;
using UnityEngine;

public class Truck3Controller : MonoBehaviour
{
    const float WHEEL_RADIUS = 0.5f;

    public List<GameObject> wheels;
    List<DistanceConstraint> constraints;
    List<Vector3> wheelLastPos;
    public GameObject body;

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

        wheelLastPos = wheels.Select( x => x.transform.position ).ToList();
    }

    Vector3 LossyReflect( Vector3 v, Vector3 n, Vector3 guess_u, float bounce, float frictionU, float frictionV )
    {
        if( Vector3.Dot( n, guess_u ) > 0.99f )
            Debug.LogError("DEGENERATE");

        var tan_v = Vector3.Cross( n, guess_u ).normalized;
        var tan_u = Vector3.Cross( n, tan_v );

        var v_n = -bounce * Vector3.Dot( v, n );
        var v_u = frictionU * Vector3.Dot( v, tan_u );
        var v_v = frictionV * Vector3.Dot( v, tan_v );

        return v_n*n + v_u*tan_u + v_v*tan_v;
    }
    
    void StepPosition( GameObject wheel, Vector3 posStep, ref Vector3 lastPos, Vector3 wheelForward )
    {
        lastPos = wheel.transform.position;
        wheel.transform.position += posStep;

        var dist = EvaluateDistanceFunc.Go( wheel.transform.position );
        if( dist < WHEEL_RADIUS )
        {
            var normal = EvaluateDistanceFunc.Normal( wheel.transform.position );
            wheel.transform.position += normal * (WHEEL_RADIUS - dist);

            var vel = wheel.transform.position - lastPos;
            vel = LossyReflect( vel, normal, wheelForward, 0.8f, 1.0f, 0.1f );
            lastPos = wheel.transform.position - vel;
        }
    }

    void FixedUpdate()
    {
        var carUp0 = Vector3.Cross( wheels[0].transform.position - wheels[1].transform.position, wheels[2].transform.position - wheels[1].transform.position ).normalized;
        var carUp1 = -Vector3.Cross( wheels[0].transform.position - wheels[3].transform.position, wheels[2].transform.position - wheels[3].transform.position ).normalized;
        var carUp = (0.5f * (carUp0 + carUp1)).normalized;

        var carForward = (wheels[2].transform.position - wheels[1].transform.position).normalized;
        var frontWheelsForward = Quaternion.AngleAxis( (Input.GetKey(KeyCode.RightArrow) ? 45 : Input.GetKey(KeyCode.LeftArrow) ? -45 : 0), Vector3.up ) * carForward;

        for( int i = 0; i < 2; ++i )
            wheels[i].transform.rotation = Quaternion.LookRotation( carForward, carUp );
        for( int i = 2; i < 4; ++i )
            wheels[i].transform.rotation = Quaternion.LookRotation( frontWheelsForward, carUp );

        body.transform.position = (
            wheels[0].transform.position +
            wheels[1].transform.position +
            wheels[2].transform.position +
            wheels[3].transform.position ) / 4;

        body.transform.rotation = 
            Quaternion.LookRotation( carForward, carUp );

        var force = Physics.gravity;
        if( Input.GetKey(KeyCode.UpArrow)) {
            force += 10 *carForward;
        }

        for( int i = 0; i < 4; ++i )
        {
            var posStep = (wheels[i].transform.position - wheelLastPos[i]) + force * Time.fixedDeltaTime * Time.fixedDeltaTime;

            Vector3 lastPos = wheelLastPos[i];
            StepPosition( wheels[i], posStep, ref lastPos, i < 2 ? carForward : frontWheelsForward );
            wheelLastPos[i] = lastPos;
        }

        for( int i = 0; i < 2; ++i )
        foreach( var c in constraints )
            c.StepSolve();

    }
}

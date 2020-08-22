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
    public GameObject cameraRig;
    List<Vector3> forceCache;

    float steerAngle;

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
        forceCache = new List<Vector3> { Vector3.zero, Vector3.zero,Vector3.zero,Vector3.zero };
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
    
    Vector3 StepPosition( GameObject wheel, Vector3 posStep, ref Vector3 lastPos, Vector3 wheelForward, bool isDrivingWheel )
    {
        lastPos = wheel.transform.position;
        wheel.transform.position += posStep;

        var dist = EvaluateDistanceFunc.Go( wheel.transform.position );
        if( dist < WHEEL_RADIUS )
        {
            var normal = EvaluateDistanceFunc.Normal( wheel.transform.position );
            wheel.transform.position += normal * (WHEEL_RADIUS - dist);

            var vel = wheel.transform.position - lastPos;
            vel = LossyReflect( vel, normal, wheelForward, 0.7f, 1, 0.1f );
            lastPos = wheel.transform.position - vel;

            if( isDrivingWheel && (Input.GetKey( KeyCode.UpArrow ) || Input.GetKey( KeyCode.DownArrow )))
            {
                var cross = Vector3.Cross( normal, wheelForward ).normalized;
                var groundedFwd = Vector3.Cross( cross, normal );

                Debug.DrawLine( wheel.transform.position, wheel.transform.position + groundedFwd, Color.red );

                return 20 * groundedFwd * ( Input.GetKey( KeyCode.UpArrow ) ? 1 : -0.5f );
            }
        }

        return Vector3.zero;
    }

    void FixedUpdate()
    {
        var carUp0 = Vector3.Cross( wheels[0].transform.position - wheels[1].transform.position, wheels[2].transform.position - wheels[1].transform.position ).normalized;
        var carUp1 = -Vector3.Cross( wheels[0].transform.position - wheels[3].transform.position, wheels[2].transform.position - wheels[3].transform.position ).normalized;
        var carUp = (0.5f * (carUp0 + carUp1)).normalized;

        if( Input.GetKey(KeyCode.RightArrow) ) {
            if( steerAngle < 25 ) steerAngle += 2;
        } else if( Input.GetKey(KeyCode.LeftArrow) ) {
            if( steerAngle > -25 ) steerAngle -= 2;
        } else if( steerAngle > 2 )
            steerAngle -= 2;
        else if( steerAngle < -2)
            steerAngle += 2;
        else
            steerAngle = 0;

        var carForward = (wheels[2].transform.position - wheels[1].transform.position).normalized;
        var frontWheelsForward = Quaternion.AngleAxis( steerAngle, Vector3.up ) * carForward; //(Input.GetKey(KeyCode.RightArrow) ? 45 : Input.GetKey(KeyCode.LeftArrow) ? -45 : 0), Vector3.up ) * carForward;

        for( int i = 0; i < 2; ++i )
            wheels[i].transform.rotation = Quaternion.LookRotation( carForward, carUp );
        for( int i = 2; i < 4; ++i )
            wheels[i].transform.rotation = Quaternion.LookRotation( frontWheelsForward, carUp );

        for( int i = 0; i < 4; ++i )
        {
            var force = Physics.gravity + forceCache[i];
            var posStep = (wheels[i].transform.position - wheelLastPos[i]) + force * Time.fixedDeltaTime * Time.fixedDeltaTime;

            Vector3 lastPos = wheelLastPos[i];
            forceCache[i] = StepPosition( wheels[i], posStep, ref lastPos, i < 2 ? carForward : frontWheelsForward, i < 2 );
            wheelLastPos[i] = lastPos;
        }

        for( int i = 0; i < 2; ++i )
        foreach( var c in constraints )
            c.StepSolve();

        body.transform.position = (
            wheels[0].transform.position +
            wheels[1].transform.position +
            wheels[2].transform.position +
            wheels[3].transform.position ) / 4;

        body.transform.rotation = 
            Quaternion.LookRotation( carForward, carUp );

        cameraRig.transform.position = body.transform.position;
        cameraRig.transform.rotation = 
            Quaternion.LookRotation( new Vector3( carForward.x, 0, carForward.z ).normalized, Vector3.up );

    }
}

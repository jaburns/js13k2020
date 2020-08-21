using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TruckController : MonoBehaviour
{
    public float wheelRadius;
    public float suspensionSize;
    public float kk;

    float subtickTime;

    public GameObject frameFrontLeft;
    public GameObject frameFrontRight;
    public GameObject frameBackLeft;
    public GameObject frameBackRight;

    public GameObject wheelFrontLeft;
    public GameObject wheelFrontRight;
    public GameObject wheelBackLeft;
    public GameObject wheelBackRight;

    SimulationObject simFrameFrontLeft;
    SimulationObject simFrameFrontRight;
    SimulationObject simFrameBackLeft;
    SimulationObject simFrameBackRight;

    class DistanceConstraint
    {
        public SimulationObject a;
        public SimulationObject b;
        public readonly float dist;

        public DistanceConstraint( SimulationObject a, SimulationObject b )
        {
            this.a = a;
            this.b = b;
            this.dist = (a.position - b.position).magnitude;
        }
    }

    class SimulationObject
    {
        public GameObject gameObject;
        public Vector3 lastPosition;
        public Vector3 position;
        public readonly GameObject wheelMarker;


        public SimulationObject( GameObject go, GameObject wheelMarker )
        {
            this.wheelMarker = wheelMarker;

            gameObject = go;
            position = go.transform.position;
            lastPosition = go.transform.position;
        }
    }

    List<DistanceConstraint> distanceConstraints;
    List<SimulationObject> objects;

    void Awake()
    {
        EvaluateDistanceFunc.Load();

        objects = new List<SimulationObject> {
            (simFrameBackLeft = new SimulationObject (    frameBackLeft  , wheelBackLeft )),
            (simFrameBackRight = new SimulationObject (   frameBackRight , wheelBackRight  )),
            (simFrameFrontLeft = new SimulationObject (   frameFrontLeft , wheelFrontLeft  )),
            (simFrameFrontRight = new SimulationObject (  frameFrontRight, wheelFrontRight )),
        };


        distanceConstraints = new List<DistanceConstraint> {
            new DistanceConstraint ( simFrameBackLeft, simFrameBackRight ),
            new DistanceConstraint ( simFrameBackLeft, simFrameFrontLeft ),
            new DistanceConstraint ( simFrameBackLeft, simFrameFrontRight ),

            new DistanceConstraint ( simFrameBackRight, simFrameFrontLeft ),
            new DistanceConstraint ( simFrameBackRight, simFrameFrontRight ),

            new DistanceConstraint ( simFrameFrontLeft, simFrameFrontRight ),
        };
    }

    void updatePosition( SimulationObject obj, Vector3 posStep, bool updateVel )
    {
        obj.position += posStep;

        var dist = EvaluateDistanceFunc.Go( obj.position );
        if( dist < wheelRadius )
        {
            var normal = EvaluateDistanceFunc.Normal( obj.position );
            obj.position += normal * (wheelRadius - dist);

            posStep = 0.8f * Vector3.Reflect( posStep, normal );
            obj.lastPosition = obj.position - posStep;
        }
    }

    void FixedUpdate()
    {
        subtickTime = 0;

        var wheelVec = Vector3.Cross( simFrameBackRight.position - simFrameBackLeft.position, simFrameFrontLeft.position - simFrameBackLeft.position ).normalized;
        Debug.DrawLine( simFrameBackLeft.position, simFrameBackLeft.position + wheelVec );

        foreach( var obj in objects )
        {
            Vector3 accel = Physics.gravity;

            var idealWheelPos = obj.position + wheelVec * suspensionSize;

            RaycastHit info;
            if( Physics.SphereCast( obj.position, wheelRadius, wheelVec, out info, suspensionSize ))
            {
                var wheelPos = info.point + info.normal * wheelRadius;
                obj.wheelMarker.gameObject.transform.position = wheelPos;
                accel -= kk * (idealWheelPos - wheelPos);
            }
            else
            {
                obj.wheelMarker.gameObject.transform.position = idealWheelPos;
            }

            var posStep = obj.position - obj.lastPosition + ( accel * Time.fixedDeltaTime * Time.fixedDeltaTime );
            obj.lastPosition = obj.position;
            updatePosition( obj, posStep, true );
        }

        for( var i = 0; i < 10; ++i )
        {
            foreach( var c in distanceConstraints )
            {
                var aToB = c.b.position - c.a.position;
                var fixVec = 0.5f * (c.dist - aToB.magnitude) * aToB.normalized;
                c.a.position -= fixVec;
                c.b.position += fixVec;
            }
        }
    }

    void Update()
    {
        subtickTime += Time.deltaTime;
        var t = subtickTime / Time.fixedDeltaTime;

        foreach( var obj in objects )
        {
            obj.gameObject.transform.position = obj.lastPosition + t * (obj.position - obj.lastPosition);
        }
    }
}

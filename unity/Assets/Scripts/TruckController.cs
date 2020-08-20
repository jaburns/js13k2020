using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TruckController : MonoBehaviour
{
    public float wheelRadius;
    public float suspensionSize;

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
        var start = obj.position;
        var mag = posStep.magnitude;

        if( Physics.OverlapSphere( obj.position, wheelRadius ).Length > 0 )
        {
            start -= 0.9f * posStep.normalized;
            mag += 0.9f;
        }

        RaycastHit info;
        if( Physics.SphereCast( start, wheelRadius, posStep.normalized, out info, mag ))
        {
            obj.position = info.point + info.normal * wheelRadius;

            if( updateVel )
            {
                posStep = 0.8f * Vector3.Reflect( posStep, info.normal );
                obj.lastPosition = obj.position - posStep;
            }
        }
        else
        {
            obj.position += posStep;
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

            RaycastHit info;
            if( Physics.SphereCast( obj.position, wheelRadius, wheelVec, out info, suspensionSize ))
            {
                var wheelPos = info.point + info.normal * wheelRadius;
                obj.wheelMarker.gameObject.transform.position = wheelPos;
                accel += 10 * (obj.position - wheelPos);
            }
            else
            {
                obj.wheelMarker.gameObject.transform.position = obj.position + wheelVec * suspensionSize;
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

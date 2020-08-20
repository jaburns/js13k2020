using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TruckController : MonoBehaviour
{
    public float wheelRadius;
    public float suspensionSize;

    public GameObject frameFrontLeft;
    public GameObject frameFrontRight;
    public GameObject frameBackLeft;
    public GameObject frameBackRight;

    public GameObject wheelFrontLeft;
    public GameObject wheelFrontRight;
    public GameObject wheelBackLeft;
    public GameObject wheelBackRight;

    float subtickTime;

    SimulationObject simFrameFrontLeft;
    SimulationObject simFrameFrontRight;
    SimulationObject simFrameBackLeft;
    SimulationObject simFrameBackRight;

    SimulationObject simWheelFrontLeft;
    SimulationObject simWheelFrontRight;
    SimulationObject simWheelBackLeft;
    SimulationObject simWheelBackRight;

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

    class SuspensionConstraint
    {
        public SimulationObject frameMain;
        public SimulationObject frameL;
        public SimulationObject frameR;
        public SimulationObject wheel;
    }

    class SimulationObject
    {
        public GameObject gameObject;
        public Vector3 lastPosition;
        public Vector3 position;

        public SimulationObject( GameObject go )
        {
            gameObject = go;
            position = go.transform.position;
            lastPosition = go.transform.position;
        }
    }

    List<DistanceConstraint> distanceConstraints;
    List<SuspensionConstraint> suspensionConstraints;
    List<SimulationObject> objects;

    void Awake()
    {
        objects = new List<SimulationObject> {
            (simFrameBackLeft = new SimulationObject (    frameBackLeft )),
            (simFrameBackRight = new SimulationObject (   frameBackRight )),
            (simFrameFrontLeft = new SimulationObject (   frameFrontLeft )),
            (simFrameFrontRight = new SimulationObject (  frameFrontRight )),

            (simWheelBackLeft = new SimulationObject (    wheelBackLeft )),
         //   (simWheelBackRight = new SimulationObject (   wheelBackRight )),
         //   (simWheelFrontLeft = new SimulationObject (   wheelFrontLeft )),
         //   (simWheelFrontRight = new SimulationObject (  wheelFrontRight)),
        };

        distanceConstraints = new List<DistanceConstraint> {
            new DistanceConstraint ( simFrameBackLeft, simFrameBackRight ),
            new DistanceConstraint ( simFrameBackLeft, simFrameFrontLeft ),
            new DistanceConstraint ( simFrameBackLeft, simFrameFrontRight ),

            new DistanceConstraint ( simFrameBackRight, simFrameFrontLeft ),
            new DistanceConstraint ( simFrameBackRight, simFrameFrontRight ),

            new DistanceConstraint ( simFrameFrontLeft, simFrameFrontRight ),
        };

        suspensionConstraints = new List<SuspensionConstraint> {
            new SuspensionConstraint { frameMain = simFrameBackLeft, frameL = simFrameFrontLeft, frameR = simFrameBackRight, wheel = simWheelBackLeft },
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

        foreach( var obj in objects )
        {
            var posStep = obj.position - obj.lastPosition + ( Physics.gravity * Time.fixedDeltaTime * Time.fixedDeltaTime );
            obj.lastPosition = obj.position;
            updatePosition( obj, posStep, true );
        }

        for( var i = 0; i < 10; ++i )
        {
            foreach( var c in distanceConstraints )
            {
                var aToB = c.b.position - c.a.position;
                var fixVec = 0.5f * (c.dist - aToB.magnitude) * aToB.normalized;
                //c.a.position -= fixVec;
                //c.b.position += fixVec;
                updatePosition( c.a, -fixVec, false );
                updatePosition( c.b,  fixVec, false );
            }

            foreach( var c in suspensionConstraints )
            {
                var axis = -Vector3.Cross( c.frameL.position - c.frameMain.position, c.frameR.position - c.frameMain.position ).normalized;
                var suspensionVec = c.wheel.position - c.frameMain.position;
                var idealDist = 0.5f * (Vector3.Dot( suspensionVec, axis ) + suspensionSize);
                var idealWheelPos = c.frameMain.position + axis * idealDist;
                var fixVec = 0.5f * (idealWheelPos - c.wheel.position);

                updatePosition( c.wheel, fixVec, false );
                updatePosition( c.frameMain, -fixVec, false );
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

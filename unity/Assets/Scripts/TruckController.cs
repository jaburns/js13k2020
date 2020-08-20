using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TruckController : MonoBehaviour
{
    public float frameRadius;
    public float wheelRadius;
    public float interWheelK;
    public float suspensionK;

    public GameObject frameObject;
    public GameObject wheelFrontLeft;
    public GameObject wheelFrontRight;
    public GameObject wheelBackLeft;
    public GameObject wheelBackRight;

    float subtickTime;

    SimulationObject simFrameObject;
    SimulationObject simWheelFrontLeft;
    SimulationObject simWheelFrontRight;
    SimulationObject simWheelBackLeft;
    SimulationObject simWheelBackRight;

    class SpringConstraint
    {
        public SimulationObject a;
        public SimulationObject b;
        public readonly float dist;
        public readonly float k;

        public SpringConstraint( float k, SimulationObject a, SimulationObject b )
        {
            this.k = k;
            this.a = a;
            this.b = b;
            this.dist = (a.position - b.position).magnitude;
        }
    }

    class SimulationObject
    {
        public GameObject gameObject;
        public Vector3 lastPositionToRender;
        public Vector3 velocity;
        public Vector3 position;
        readonly public float radius;

        public SimulationObject( float radius, GameObject go )
        {
            this.radius = radius;
            gameObject = go;
            position = go.transform.position;
            velocity = Vector3.zero;
            lastPositionToRender = go.transform.position;
        }
    }

    List<SpringConstraint> springConstraints;
    List<SimulationObject> objects;

    void Awake()
    {
        objects = new List<SimulationObject> {
            (simFrameObject = new SimulationObject ( frameRadius,   frameObject )),
            (simWheelBackLeft = new SimulationObject (    wheelRadius, wheelBackLeft )),
            (simWheelBackRight = new SimulationObject (   wheelRadius, wheelBackRight )),
            (simWheelFrontLeft = new SimulationObject (   wheelRadius, wheelFrontLeft )),
            (simWheelFrontRight = new SimulationObject (  wheelRadius, wheelFrontRight)),
        };

        springConstraints = new List<SpringConstraint> {
            new SpringConstraint ( suspensionK, simFrameObject, simWheelBackLeft ),
            new SpringConstraint ( suspensionK, simFrameObject, simWheelBackRight ),
            new SpringConstraint ( suspensionK, simFrameObject, simWheelFrontLeft ),
            new SpringConstraint ( suspensionK, simFrameObject, simWheelFrontRight ),

            new SpringConstraint ( interWheelK, simWheelBackLeft, simWheelBackRight ),
            new SpringConstraint ( interWheelK, simWheelBackLeft, simWheelFrontLeft ),
            new SpringConstraint ( interWheelK, simWheelBackLeft, simWheelFrontRight ),

            new SpringConstraint ( interWheelK, simWheelBackRight, simWheelFrontLeft ),
            new SpringConstraint ( interWheelK, simWheelBackRight, simWheelFrontRight ),

            new SpringConstraint ( interWheelK, simWheelFrontLeft, simWheelFrontRight ),
        };
    }

    void stepPosition( SimulationObject obj, Vector3 posStep )
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
            obj.velocity = 0.8f * Vector3.Reflect( obj.velocity, info.normal );
        }
        else
        {
            obj.position += posStep;
        }
    }

    Vector3 getAcceleration( SimulationObject obj )
    {
        var result = Physics.gravity;

        foreach( var c in springConstraints )
        {
            if( c.a != obj && c.b != obj ) continue;
            var self = c.a == obj ? c.a : c.b;
            var other = c.a == obj ? c.b : c.a;

            var selfFromOther = self.position - other.position;
            var x = c.dist - selfFromOther.magnitude;

            result += selfFromOther.normalized * c.k * x;
        }

        return result;
    }

    void FixedUpdate()
    {
        subtickTime = 0;

        foreach( var c in springConstraints )
        {
            Debug.DrawLine( c.a.position, c.b.position );
        }

        foreach( var obj in objects )
        {
            obj.lastPositionToRender = obj.position;
            obj.velocity += getAcceleration( obj ) * Time.fixedDeltaTime;
            stepPosition( obj, obj.velocity * Time.fixedDeltaTime );
        }
    }

    void Update()
    {
        subtickTime += Time.deltaTime;
        var t = subtickTime / Time.fixedDeltaTime;

        foreach( var obj in objects )
        {
            obj.gameObject.transform.position = obj.lastPositionToRender + t * (obj.position - obj.lastPositionToRender);
        }
    }
}

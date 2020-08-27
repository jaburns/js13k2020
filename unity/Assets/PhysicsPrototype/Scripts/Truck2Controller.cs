using UnityEngine;
using System.Collections.Generic;

public class Truck2Controller : MonoBehaviour
{
    const float WHEEL_RADIUS = 0.5f;

    public float spinConst = 0.05f;
    public float springConst = 100;

    public GameObject frameObject;
    public GameObject wheelFrontLeft;
    public GameObject wheelFrontRight;
    public GameObject wheelBackLeft;
    public GameObject wheelBackRight;

    public Quaternion angularVelocity;
    public Vector3 velocity;
    Quaternion rotation;
    Vector3 position;

    List<Wheel> wheels;

    Vector3 forceCache;
    Quaternion torqueCache;

    class Wheel
    {
        GameObject obj;
        Vector3 wheelRootPos;
        Vector3 wheelRestPos;
        float wheelDepth;

        float springConst;
        float spinConst;

        float lastCompression;
        Vector3? lastCompressedWheelPos;

        public Wheel( Vector3 rootPos, GameObject obj, float springConst, float spinConst )
        {
            this.spinConst = spinConst;
            this.springConst = springConst;

            this.obj = obj;
            this.wheelRestPos = obj.transform.position - rootPos;
            this.wheelDepth = -this.wheelRestPos.y;
            this.wheelRootPos = new Vector3( this.wheelRestPos.x, 0, this.wheelRestPos.z );
        }

        public void Step( bool first, Vector3 rootPos, Quaternion rootRot, ref Vector3 forceCache, ref Quaternion torqueCache )
        {
            var wheelAxis = rootRot * Vector3.down;
            var wheelRootPos1 = rootPos + rootRot * wheelRootPos;
            var wheelRestPos1 = rootPos + rootRot * wheelRestPos;

            RaycastHit info;
            if( Physics.SphereCast( wheelRootPos1, WHEEL_RADIUS, (wheelRestPos1 - wheelRootPos1).normalized, out info, wheelDepth ))
            {
                var collidedPos = info.point + info.normal * WHEEL_RADIUS;
                var springVec = collidedPos - wheelRestPos1;

                if( lastCompressedWheelPos.HasValue )
                {
                    forceCache += 50 * (lastCompressedWheelPos.Value - collidedPos);
                }

                var newCompression = springVec.magnitude;
                if( newCompression < lastCompression )
                {
                    springVec *= 0.6f;
                }

                lastCompression = newCompression;
                lastCompressedWheelPos = collidedPos;

                forceCache += springConst * springVec;

                var momentArmLength = wheelRootPos.magnitude;
                var rotationAxis = Vector3.Cross( springVec, wheelRootPos ).normalized;

                if( first )
                {
                    Debug.DrawLine( Vector3.zero, rotationAxis.normalized );
                }

                torqueCache *= Quaternion.AngleAxis( -spinConst * momentArmLength, rotationAxis );

                obj.transform.position = collidedPos;
            }
            else
            {
                lastCompressedWheelPos = null;
                obj.transform.position = wheelRestPos1;
            }
        }
    }

    void Start()
    {
        position = frameObject.transform.position;
        rotation = frameObject.transform.rotation;
        angularVelocity = Quaternion.Slerp( Quaternion.identity, angularVelocity.normalized, 0.005f );

        wheels = new List<Wheel> {
            new Wheel( position, wheelFrontLeft , springConst, spinConst ),
            new Wheel( position, wheelFrontRight, springConst, spinConst ),
            new Wheel( position, wheelBackLeft  , springConst, spinConst ),
            new Wheel( position, wheelBackRight , springConst, spinConst ),
        };
    }

    void FixedUpdate()
    {
        velocity += (forceCache + Physics.gravity) * Time.fixedDeltaTime;

        var quat = Quaternion.Slerp( Quaternion.identity, torqueCache, Time.fixedDeltaTime );
        for( int i = 0; i < 100; ++i ) angularVelocity *= quat;

        forceCache = Vector3.zero;
        torqueCache = Quaternion.identity;

        position += velocity * Time.fixedDeltaTime;

        quat = Quaternion.Slerp( Quaternion.identity, angularVelocity, Time.fixedDeltaTime );
        for( int i = 0; i < 100; ++i ) rotation *= quat;

        var first = true;
        foreach( var wheel in wheels )
        {
            wheel.Step( first, position, rotation, ref forceCache, ref torqueCache );
            first = false;
        }

        frameObject.transform.rotation = rotation;
        frameObject.transform.position = position;


    }
}

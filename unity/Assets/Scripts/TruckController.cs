using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TruckController : MonoBehaviour
{
    Vector3 oldPosition;

    Vector3 velocity;
    Vector3 position;

    float subtickTime;

    void Awake()
    {
        position = transform.position;
        oldPosition = position;
    }

    void FixedUpdate()
    {
        subtickTime = 0;
        oldPosition = position;

        velocity += Physics.gravity * Time.fixedDeltaTime;
        position += velocity * Time.fixedDeltaTime;
    }

    void Update()
    {
        subtickTime += Time.deltaTime;
        var t = subtickTime / Time.fixedDeltaTime;

        transform.position = oldPosition + t * (position - oldPosition);
    }
}

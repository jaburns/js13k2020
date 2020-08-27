using UnityEngine;
using System.Collections.Generic;

public class MapObject : MonoBehaviour
{
    public enum Kind
    {
        Box = 0,
        StraightTrack = 1,
        CurvedTrack = 2,
    }

    public Kind kind;
    public List<float> parames;

    public string GetFn()
    {
        return "sdObj" + (int)kind;
    }
}
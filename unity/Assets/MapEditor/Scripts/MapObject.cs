using UnityEngine;

public class MapObject : MonoBehaviour
{
    public enum Kind
    {
        Box = 0,
        StraightTrack = 1,
    }

    public Kind kind;
}

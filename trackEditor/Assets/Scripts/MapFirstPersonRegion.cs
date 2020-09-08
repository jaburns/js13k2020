using UnityEngine;

public class MapFirstPersonRegion : MonoBehaviour
{
    public float radius; 

    void OnDrawGizmos()
    {
        Gizmos.color = Color.white;
        Gizmos.DrawWireSphere( transform.position, radius );
    }
}
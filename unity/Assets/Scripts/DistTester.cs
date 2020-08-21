using UnityEngine;

[ExecuteInEditMode]
public class DistTester : MonoBehaviour
{
    void Update()
    {
        EvaluateDistanceFunc.Load();
        Debug.Log( EvaluateDistanceFunc.Go( transform.position ));
    }
}

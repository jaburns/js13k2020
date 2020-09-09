using UnityEngine;

[ExecuteInEditMode]
public class MapEditorCamera : MonoBehaviour
{
    static Camera thisCam;

    void Update()
    {
        MapCompiler.mainCamera = GetComponent<Camera>();
    }
}
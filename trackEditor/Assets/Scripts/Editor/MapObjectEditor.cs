using UnityEditor;
using System.Linq;

[CustomEditor(typeof(MapObject))]
public class MapObjectEditor : Editor
{
    MapObject targ { get { return target as MapObject; } }

    void makeProps( params string[] names )
    {
        while( targ.parames.Count < names.Length )
            targ.parames.Add( 0f );

        while( targ.parames.Count > names.Length )
            targ.parames.RemoveAt( targ.parames.Count - 1 );
        
        for( int i = 0; i < names.Length; ++i )
            targ.parames[i] = EditorGUILayout.FloatField( names[i], targ.parames[i] );
    }

    override public void OnInspectorGUI()
    {
        base.OnInspectorGUI();

        switch( targ.kind )
        {
            case MapObject.Kind.Box:
            case MapObject.Kind.Bumper:
            {
                makeProps();
                break;
            }

            case MapObject.Kind.StraightTrack:
            {
                makeProps( "Twist", "Material", "Bumper" );
                break;
            }

            case MapObject.Kind.CurvedTrack:
            {
                makeProps( "Radius", "Bank", "Bumper", "Material" );
                break;
            }

            case MapObject.Kind.Shrinker:
            {
                makeProps( "Half Width B", "Bumper" );
                break;
            }
        }
    }
}

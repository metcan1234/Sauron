#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;

public class SauronGamedevWindow : EditorWindow
{
    [MenuItem("Sauron/Game Dev Bridge")]
    public static void Open()
    {
        GetWindow<SauronGamedevWindow>("Sauron Game Dev");
    }

    void OnGUI()
    {
        GUILayout.Label("Sauron Game Dev Bridge", EditorStyles.boldLabel);
        GUILayout.Label("TCP 7890 — CoplayDev unity-mcp ile birlikte kullanın.");
        if (GUILayout.Button("Play log dosyasını aç"))
        {
            var logPath = Path.Combine(Application.dataPath, "..", ".sauron", "gamedev-play-log.txt");
            if (File.Exists(logPath))
            {
                EditorUtility.RevealInFinder(logPath);
            }
            else
            {
                EditorUtility.DisplayDialog("Sauron", "Henüz play log yok.", "Tamam");
            }
        }
    }
}
#endif

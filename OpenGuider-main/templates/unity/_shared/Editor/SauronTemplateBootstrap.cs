#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

[InitializeOnLoad]
public static class SauronTemplateBootstrap
{
    static SauronTemplateBootstrap()
    {
        EditorApplication.delayCall += EnsurePlayableBase;
    }

    static void EnsurePlayableBase()
    {
        var markerPath = Path.Combine(Application.dataPath, "..", ".sauron", "gamedev-template.json");
        if (!File.Exists(markerPath))
        {
            return;
        }

        var genreRoot = FindSauronGenreRoot();
        if (string.IsNullOrEmpty(genreRoot))
        {
            return;
        }

        var sceneDir = Path.Combine(genreRoot, "Scenes");
        var scenePath = Path.Combine(sceneDir, "Main.unity").Replace("\\", "/");
        if (!File.Exists(scenePath))
        {
            Directory.CreateDirectory(sceneDir);
            var templateScene = Path.Combine(Application.dataPath, "SauronGameDev", "_shared", "Scenes", "Main.unity");
            if (File.Exists(templateScene))
            {
                File.Copy(templateScene, scenePath, true);
                AssetDatabase.Refresh();
            }
        }

        if (File.Exists(scenePath))
        {
            var active = SceneManager.GetActiveScene();
            if (!active.IsValid() || !active.path.EndsWith("Main.unity"))
            {
                EditorSceneManager.OpenScene(scenePath);
            }
        }

        EnsureNetworkManager(genreRoot);
        EnsureGenreObjects(genreRoot);
    }

    static string FindSauronGenreRoot()
    {
        var baseDir = Path.Combine(Application.dataPath, "SauronGameDev");
        if (!Directory.Exists(baseDir))
        {
            return null;
        }

        foreach (var dir in Directory.GetDirectories(baseDir))
        {
            var name = Path.GetFileName(dir);
            if (name == "_shared")
            {
                continue;
            }
            if (Directory.Exists(Path.Combine(dir, "Scenes")) || Directory.GetFiles(dir, "*.cs").Length > 0)
            {
                return dir.Replace("\\", "/");
            }
        }
        return null;
    }

    static void EnsureNetworkManager(string genreRoot)
    {
        if (GameObject.Find("NetworkManager") != null)
        {
            return;
        }

        var go = new GameObject("NetworkManager");
        var genre = Path.GetFileName(genreRoot).ToLowerInvariant();
        if (genre.Contains("social"))
        {
            go.name = "NetworkManager_Social";
        }
        else if (genre.Contains("horror") || genre.Contains("climb"))
        {
            go.name = "NetworkManager";
        }
        Undo.RegisterCreatedObjectUndo(go, "Sauron NetworkManager");
    }

    static void EnsureGenreObjects(string genreRoot)
    {
        var genre = Path.GetFileName(genreRoot).ToLowerInvariant();
        if (genre.Contains("horror") && GameObject.Find("PlayerSpawn") == null)
        {
            var spawn = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            spawn.name = "PlayerSpawn";
            spawn.transform.position = new Vector3(0f, 1f, 0f);
            Undo.RegisterCreatedObjectUndo(spawn, "Sauron PlayerSpawn");
        }

        if (genre.Contains("social") && GameObject.Find("LobbyCanvas") == null)
        {
            var canvasGo = new GameObject("LobbyCanvas");
            Undo.RegisterCreatedObjectUndo(canvasGo, "Sauron LobbyCanvas");
        }

        if (genre.Contains("climb") && GameObject.Find("ClimbPlatform") == null)
        {
            var platform = GameObject.CreatePrimitive(PrimitiveType.Cube);
            platform.name = "ClimbPlatform";
            platform.transform.position = new Vector3(0f, 2f, 5f);
            platform.transform.localScale = new Vector3(4f, 0.5f, 4f);
            Undo.RegisterCreatedObjectUndo(platform, "Sauron ClimbPlatform");
        }
    }
}
#endif

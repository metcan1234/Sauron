using System;
using System.IO;
using UnityEngine;

public class SauronPlayLogForwarder : MonoBehaviour
{
    static string LogPath =>
        Path.Combine(Application.dataPath, "..", ".sauron", "gamedev-play-log.txt");

    void OnEnable()
    {
        Application.logMessageReceived += HandleLog;
    }

    void OnDisable()
    {
        Application.logMessageReceived -= HandleLog;
    }

    static void HandleLog(string condition, string stackTrace, LogType type)
    {
        try
        {
            var dir = Path.GetDirectoryName(LogPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }
            var line = $"{DateTime.UtcNow:o} [{type}] {condition}\n";
            File.AppendAllText(LogPath, line);
        }
        catch
        {
            // ignore IO errors in play mode
        }
    }
}

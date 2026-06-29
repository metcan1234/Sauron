using System.Collections.Generic;
using UnityEngine;

namespace SauronGameDev.SocialDeduction
{
    public class LobbyManager : MonoBehaviour
    {
        [SerializeField] int minPlayers = 4;
        [SerializeField] int maxPlayers = 12;
        readonly List<string> lobbyPlayers = new();

        public void AddPlayer(string playerId)
        {
            if (lobbyPlayers.Count >= maxPlayers) return;
            if (!lobbyPlayers.Contains(playerId)) lobbyPlayers.Add(playerId);
        }

        public bool CanStart => lobbyPlayers.Count >= minPlayers;
    }
}

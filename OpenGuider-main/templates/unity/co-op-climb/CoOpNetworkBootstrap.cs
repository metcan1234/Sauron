using Unity.Netcode;
using UnityEngine;

namespace SauronGameDev.CoOpClimb
{
    public class CoOpNetworkBootstrap : NetworkBehaviour
    {
        public static CoOpNetworkBootstrap Instance { get; private set; }

        void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        public void StartHostGame() => NetworkManager.Singleton?.StartHost();
        public void StartClientGame() => NetworkManager.Singleton?.StartClient();
        public int MaxPlayers => 4;
    }
}

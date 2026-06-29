using Unity.Netcode;
using UnityEngine;

namespace SauronGameDev.HorrorCoop
{
    public class HorrorNetworkLobby : NetworkBehaviour
    {
        public void HostLobby() => NetworkManager.Singleton?.StartHost();
        public void JoinLobby() => NetworkManager.Singleton?.StartClient();
        public int MaxPlayers => 4;
    }
}

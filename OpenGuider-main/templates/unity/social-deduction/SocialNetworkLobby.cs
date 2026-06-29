using Unity.Netcode;
using UnityEngine;

namespace SauronGameDev.SocialDeduction
{
    public class SocialNetworkLobby : NetworkBehaviour
    {
        public void HostSession() => NetworkManager.Singleton?.StartHost();
        public void JoinSession() => NetworkManager.Singleton?.StartClient();
        public int MaxPlayers => 12;
    }
}

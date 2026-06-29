using UnityEngine;

namespace SauronGameDev.HorrorCoop
{
    public class ExitTrigger : MonoBehaviour
    {
        void OnTriggerEnter(Collider other)
        {
            if (!other.CompareTag("Player")) return;
            Debug.Log("SauronGameDev: Escape win condition triggered.");
        }
    }
}

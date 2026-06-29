using UnityEngine;

namespace SauronGameDev.HorrorCoop
{
    public class FlashlightController : MonoBehaviour
    {
        [SerializeField] Light spotLight;
        [SerializeField] float drainRate = 2f;
        float battery = 100f;

        void Update()
        {
            if (spotLight != null) spotLight.enabled = battery > 0f;
            battery = Mathf.Max(0f, battery - drainRate * Time.deltaTime);
        }
    }
}

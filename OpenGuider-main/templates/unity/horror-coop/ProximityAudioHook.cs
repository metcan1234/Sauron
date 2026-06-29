using UnityEngine;

namespace SauronGameDev.HorrorCoop
{
    public class ProximityAudioHook : MonoBehaviour
    {
        [SerializeField] AudioSource source;
        [SerializeField] float maxDistance = 12f;

        public void PlayAtDistance(Vector3 listenerPosition)
        {
            if (source == null) return;
            var dist = Vector3.Distance(transform.position, listenerPosition);
            source.volume = Mathf.Clamp01(1f - dist / maxDistance);
            if (!source.isPlaying) source.Play();
        }
    }
}

using UnityEngine;

namespace SauronGameDev.CoOpClimb
{
    public class StaminaSystem : MonoBehaviour
    {
        [SerializeField] float maxStamina = 100f;
        float current;

        void Awake() => current = maxStamina;

        public float Current => current;
        public float Max => maxStamina;

        public void Drain(float amount)
        {
            current = Mathf.Max(0f, current - amount);
        }

        public void Recover(float amount)
        {
            current = Mathf.Min(maxStamina, current + amount);
        }
    }
}

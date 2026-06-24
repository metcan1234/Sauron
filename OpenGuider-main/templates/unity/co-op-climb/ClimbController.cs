using UnityEngine;

namespace SauronGameDev.CoOpClimb
{
    public class ClimbController : MonoBehaviour
    {
        [SerializeField] float climbSpeed = 2f;
        [SerializeField] StaminaSystem stamina;

        public void TryClimb(Vector3 direction)
        {
            if (stamina != null && stamina.Current <= 0f) return;
            transform.position += direction.normalized * climbSpeed * Time.deltaTime;
            stamina?.Drain(5f * Time.deltaTime);
        }
    }
}

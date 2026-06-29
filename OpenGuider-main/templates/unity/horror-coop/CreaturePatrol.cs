using UnityEngine;

namespace SauronGameDev.HorrorCoop
{
    public class CreaturePatrol : MonoBehaviour
    {
        [SerializeField] Transform[] waypoints;
        [SerializeField] float speed = 2f;
        int index;

        void Update()
        {
            if (waypoints == null || waypoints.Length == 0) return;
            var target = waypoints[index];
            transform.position = Vector3.MoveTowards(transform.position, target.position, speed * Time.deltaTime);
            if (Vector3.Distance(transform.position, target.position) < 0.2f)
            {
                index = (index + 1) % waypoints.Length;
            }
        }
    }
}

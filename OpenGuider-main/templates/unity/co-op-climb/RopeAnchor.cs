using UnityEngine;

namespace SauronGameDev.CoOpClimb
{
    public class RopeAnchor : MonoBehaviour
    {
        [SerializeField] Transform anchorPoint;

        public Vector3 AnchorPosition => anchorPoint != null ? anchorPoint.position : transform.position;
    }
}

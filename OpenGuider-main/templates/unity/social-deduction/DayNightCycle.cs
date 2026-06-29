using UnityEngine;

namespace SauronGameDev.SocialDeduction
{
    public class DayNightCycle : MonoBehaviour
    {
        public enum Phase { Day, Night }
        public Phase Current { get; private set; } = Phase.Day;

        public void AdvancePhase()
        {
            Current = Current == Phase.Day ? Phase.Night : Phase.Day;
        }
    }
}

using System.Collections.Generic;
using UnityEngine;

namespace SauronGameDev.SocialDeduction
{
    public class VoteUI : MonoBehaviour
    {
        readonly Dictionary<string, int> votes = new();

        public void CastVote(string voterId, string targetId)
        {
            votes[voterId] = votes.GetValueOrDefault(voterId, 0);
            votes[targetId] = votes.GetValueOrDefault(targetId, 0) + 1;
        }

        public string GetLeadingTarget()
        {
            string leader = null;
            var max = 0;
            foreach (var pair in votes)
            {
                if (pair.Value > max)
                {
                    max = pair.Value;
                    leader = pair.Key;
                }
            }
            return leader;
        }
    }
}

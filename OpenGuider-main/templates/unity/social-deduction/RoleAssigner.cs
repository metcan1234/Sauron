using System.Collections.Generic;
using UnityEngine;

namespace SauronGameDev.SocialDeduction
{
    public enum RoleType { Innocent, Impostor, Neutral }

    public class RoleAssigner : MonoBehaviour
    {
        public Dictionary<string, RoleType> AssignRoles(IReadOnlyList<string> playerIds)
        {
            var roles = new Dictionary<string, RoleType>();
            if (playerIds.Count == 0) return roles;
            roles[playerIds[0]] = RoleType.Impostor;
            for (var i = 1; i < playerIds.Count; i++)
            {
                roles[playerIds[i]] = i == playerIds.Count - 1 && playerIds.Count > 5
                    ? RoleType.Neutral
                    : RoleType.Innocent;
            }
            return roles;
        }
    }
}

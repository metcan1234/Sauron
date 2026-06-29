using UnityEngine;

namespace SauronGameDev.CoOpClimb
{
    public class ProceduralClimbChunk : MonoBehaviour
    {
        [SerializeField] int chunkHeight = 8;
        [SerializeField] GameObject ledgePrefab;

        public void GenerateChunk(int seed)
        {
            Random.InitState(seed);
            for (var i = 0; i < chunkHeight; i++)
            {
                if (ledgePrefab == null) continue;
                var offset = new Vector3(Random.Range(-2f, 2f), i * 2f, Random.Range(-1f, 1f));
                Instantiate(ledgePrefab, transform.position + offset, Quaternion.identity, transform);
            }
        }
    }
}

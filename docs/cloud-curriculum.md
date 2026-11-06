# Cloud inference curriculum

Play order: original Transformer → modern models → cloud inference → on-device inference.
This is a learning sequence, not a claim that cloud deployment is a prerequisite for using an on-device model.

## Playable progression: one GPU before two GPUs

| Level | Player action | What the computation checks |
|---|---|---|
| `#single-upload` | Upload CPU input, compute with a complete GPU matrix, read back the output. | Device residency plus exact `XW`; 24 feature bytes copied per input. |
| `#single-fallback` | Route a GPU → CPU → GPU detour for the CPU-only ReLU provided in this lesson. | Correct FFN values and valid memory locations; 48 feature bytes copied. |
| `#single-resident` | Choose a GPU ReLU so intermediate features stay resident. | Same FFN values with at most 16 feature bytes copied. |
| `#tp-columns` | Place two column shards, route the same input to both, collect their outputs in feature order. | `X [W0 W1] = concat(XW0, XW1)`. |
| `#tp-rows` | Split a projected input into feature halves, match each to the corresponding weight rows, reduce their partial results. | `[H0 H1] [D0; D1] = H0 D0 + H1 D1`. |
| `#tp-ffn` | Keep each intermediate shard local through ReLU, apply row-parallel output weights, then reduce. | Matches the unsharded `ReLU(XW) D`, including inputs with negative features. |

Every level starts with an empty board. The first three lessons have one GPU; input and output live on the CPU. GPU/CPU operators require tensors in their own memory. Copy nodes preserve values while changing residency. The fallback lesson deliberately provides only CPU ReLU; it does not claim ReLU cannot run on GPUs. Copy accounting follows the output dependency path at four bytes per FP32 feature. Weights are already resident and their initial upload is outside this exercise. The third lesson rejects an otherwise numerically correct 48-byte detour because its displayed budget is 16 bytes. The original two-GPU puzzles keep their existing inventories and saved graphs. Previously introduced parts remain available as alternatives. GPU labels indicate fixed mathematical ownership; dragging a module changes the layout, not its device assignment. These lessons do not enforce GPU capacity budgets, measure wall-clock speed, simulate real GPU concurrency, or load model weights. Feature-copy budgets are separate from memory capacity. Its five test inputs check exact arithmetic. The use of ReLU isolates tensor parallelism using the player's familiar FFN; it is not a claim that GLM-5.3 or Kimi K3 uses that FFN.

The gather collects one full output at the outlet; it is not an All-Gather replica on every device. Likewise the reduce sums contributions at one outlet; a real All-Reduce additionally distributes that result. Cards explain the distinction. Reduce uses the same addition animation as residuals but has different input semantics.

## Planned progression — not playable yet

| Stage | Puzzle and visible feedback | What makes it a reasoning task |
|---|---|---|
| 07 · Memory capacity | Place weight shards and KV allocations in visible GPU memory trays. | Account for resident weights, runtime buffers and KV, rather than assuming active MoE parameters equal resident parameter memory. |
| 08 · Nodes and collectives | Arrange a TP group within/between two server racks; route collective traffic. | The same arithmetic can take very different communication paths; show bytes, synchronization and a documented synthetic cost model. |
| 09 · Expert parallelism | Route token packets to top-k experts, then combine weighted expert outputs. | Distinguish token-to-expert routing from tensor sharding; handle hot experts, imbalance and All-to-All traffic. |
| 10 · Continuous batching | Admit and retire variable-length requests while managing KV blocks. | Trade utilization against per-request latency and capacity; no universal “largest batch wins.” |
| 11 · Prefill / Decode separation | Assign long prompt chunks and token-by-token decode to separate pools; transfer state. | Prefill and decode have different reuse patterns; transferring KV/state has a cost. |
| 12 · CUDA Graph | Assemble a reusable launch sequence, capture compatible shapes, then route replay and fallback requests. | Replay reduces repeated CPU launch work; it does not remove GPU arithmetic or collectives. Address/shape stability, memory pools, padding and capture overhead matter. Graph capture is distinct from kernel fusion. |
| 13 · MTP proposal | Use a model's auxiliary prediction machinery to propose several candidate tokens. | Proposals are not committed output. Show why trained prediction heads and a speculative decoding algorithm are distinct. |
| 14 · Verification and rollback | Verify a candidate prefix with the target model; keep the accepted prefix and repair rejected token/state updates. | First teach deterministic greedy verification. A later sampling exercise must use an appropriate acceptance/correction algorithm to preserve the target distribution. Draft and verification costs and acceptance length determine speedup. |
| 15 · GLM deployment case | Use a pinned model configuration and serving-engine recipe to combine memory, parallelism, graph execution and supported speculation. | Compare several workloads, without claiming a single fastest configuration. |
| 16 · Kimi deployment case | Repeat the budget and scheduling problem using Kimi K3's different model structure and deployment support. | Do not treat Kimi K3 as GLM with different parameter counts, or copy GLM's cache layout/MTP configuration. |

Each stage should first add one new mechanic, then combine it with learned components. Device placement, routing, memory allocation and timeline manipulation should be direct interactions, rather than a list of multiple-choice configuration switches. Mid-run feedback should animate state and traffic without revealing solutions; end-of-run diagnostics should identify mismatches. Performance targets will require multiple workload checks and a clearly documented synthetic model.

## Model references, pinned 2026-11-06

- [GLM-5.3 model card](https://huggingface.co/zai-org/GLM-5.3/blob/ba32f8c19c8738e2c57c71798c601d477a7bf844/README.md), revision `ba32f8c19c8738e2c57c71798c601d477a7bf844`.
- [GLM-5.3 configuration](https://huggingface.co/zai-org/GLM-5.3/blob/ba32f8c19c8738e2c57c71798c601d477a7bf844/config.json): `n_routed_experts=256`, `num_experts_per_tok=8`, `num_nextn_predict_layers=1`. These fields describe this revision; they do not alone establish a serving engine's MTP support or speedup.
- [Kimi K3 model card](https://huggingface.co/moonshotai/Kimi-K3/blob/f831ab66814297da540d832a5235f8e904f29d06/README.md), revision `f831ab66814297da540d832a5235f8e904f29d06`.
- [Kimi K3 configuration](https://huggingface.co/moonshotai/Kimi-K3/blob/f831ab66814297da540d832a5235f8e904f29d06/config.json). The card describes KDA, Attention Residuals and Stable LatentMoE, with 16 of 896 routed experts activated. Its cache and recurrent state must be derived from the actual implementation, not copied from a dense Transformer KV lesson.
- [NVIDIA collective operations](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html).
- [CUDA Graph documentation](https://docs.nvidia.com/cuda/cuda-programming-guide/04-special-topics/cuda-graphs.html).
- Deployment recipes linked by the model cards: [GLM-5.3 / vLLM](https://recipes.vllm.ai/zai-org/GLM-5.3), [Kimi K3 / vLLM](https://recipes.vllm.ai/moonshotai/Kimi-K3). Pin a compatible serving-engine commit when implementing each case; these recipe URLs can change.

The shipped miniature arithmetic is original teaching code. No model weights, model-card screenshots, benchmark numbers or serving-engine source are bundled into the game.

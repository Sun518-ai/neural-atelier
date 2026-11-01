# Neural Atelier teaching model

This prototype has 25 playable levels, using the existing Three.js tabletop, ports, wiring, module cards and runtime packets. The source is deliberately independent of real model weights and device APIs.

## Reference boundary

Design reference inspected locally: Kapitsa checkout `kapitsa-perf-swiglu`, commit `fa1ea30fb1a88bba2977827441084bb836204baf`, with its README and `docs/numerical-history.md`. Those sources describe GPU/ANE collaboration for prefill and the distinction between prefill, decode, cached state and numerical tolerances. No measured performance values are copied into the game. This is a conceptual curriculum, not a reproduction of Kapitsa or Qwen3.8-27B.

## Actual miniature calculations

The first six levels use two-feature vectors and fixed FFN weights. Network levels use three positions, two features and a single attention head. Q/K/V projections, RoPE, scaled QK transpose, causal mask, softmax, AV, output projection, residuals and SwiGLU execute actual arithmetic. The six-word vocabulary has fixed weights and biases; token output is argmax of computed scores. Incorrect features can therefore yield different words. Intermediate feature rows are indexed by input position and are never represented as newly generated tokens.

Autoregression is deliberately a separate fixed-transition miniature language model. It appends only the last position's next-token prediction. It is not a trained natural language model. KV validation compares incremental attention with recomputation and checks numerical equality and projected row counts.

## Performance model

`engine-model.js` is a deterministic teaching cost model, not a benchmark, simulator of Apple microarchitecture, or actual hardware utilization measurement. The numeric pipeline uses real quantized miniature weights. Costs account for task placement, fixed dispatch overhead per batch, synchronization, layout conversion, materializing intermediates, rereading weights, cached K/V and prefix reuse. Prefill can split projection/FFN work across two simulated processors; its cost is the slower partition plus synchronization. Decode has a distinct weight-read term and little reuse per generated token.

The 27B parameter count is used only for decimal-GB storage arithmetic. Metadata overhead, bandwidth, task times, scratch memory and KV bytes per position are invented teaching coefficients. ANE supports only projection/FFN in these exercises; this is not a universal statement of real ANE support. The displayed ANE work share is allocated work, not measured busy time. Quantization is a simple global symmetric scheme, not Kapitsa's production quantizer. Error gates apply to the tiny numerical examples only and do not establish real language-model quality.

## Validation

Run `npm ci` and then `npm test`.

Tests cover every correct circuit, causal isolation, rotation norm preservation, vocabulary changes, autoregression, cache equality, cycles, incomplete traces, actual quantization differences, every performance level's solution using only its visible controls, DOM reports and saved settings, construction of all Three.js scenes, finite scene transforms, every module card, and dismiss/reappear behavior. DOM/scene tests use LinkeDOM and a stub renderer; they do not prove actual browser rasterization or pointer hit testing.

The site consists of static files. Serve this directory over HTTP for local development; see README.md.

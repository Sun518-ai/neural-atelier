# Neural Atelier

**English** · [简体中文](README.zh-CN.md)

[![Neural Atelier — a 3D neural-network wiring puzzle](docs/images/social-preview.png)](https://hacking.pub/games/neural-atelier/)

**Build a neural network with your own hands.** Connect modules on a 3D workbench, run your circuit, and watch vectors travel through the computations. If the output misses the target, inspect the modules and try a different connection.

**[Play in your browser →](https://hacking.pub/games/neural-atelier/)** · [Run locally](#run-locally) · [How to play](#how-to-play)

49 levels · Desktop / WebGL 2 · English + Chinese · No account required

## Inside the workshop

Start with one wire and a small matrix. Later, combine projections, activation, gating, and residual connections into a working FFN. Double-click a module to open its illustrated card, rotate its model, and explore its computation.

| A matrix changes the vector | A closer look inside a module |
| --- | --- |
| ![Input vectors connected through a matrix projection to four-feature outputs](docs/images/matrix-projection.jpg) | ![Gate projection card showing its 3D model, matrix, formula, and example](docs/images/module-card.jpg) |

<sub>Gameplay images, including the cover, use captures from an earlier Chinese-language build. The current game supports both English and Chinese.</sub>

The circuit you build determines the result. Run it to see data move through the network; feedback appears at the end, leaving you room to work out the connections yourself.

## From the first wire to an inference engine

The **27-level main track** teaches the original Transformer first. **13 modern extensions** then compare SiLU, SwiGLU, RMSNorm, Pre-LN, and RoPE. A separate **9-level bonus track** explores on-device inference inspired by Qwen 27B, Kapitsa, and Apple ANE. Choose a track from the level menu; finishing one does not automatically enter another.

| Stage | What you build and explore |
| --- | --- |
| **Prologue · 7 levels** | Route a vector, project, apply ReLU, down-project, assemble the original FFN, add a residual, and practice placing modules. |
| **Original network · 20 levels** | Embeddings, sinusoidal positions, LayerNorm and Post-LN; Q/K/V, scores, Softmax, weighted aggregation, single-head and multi-head attention; a four-feature bridge, encoder, masked attention, cross-attention, decoder, and the complete encoder–decoder. Finish with vocabulary scores, selection and a separate generation-loop exercise. |
| **Modern extensions · 13 levels** | Compare SiLU, single-branch and gated FFNs, SwiGLU, RMSNorm, Pre-LN, RoPE and a modern decoder block. |
| **On-device inference · 9 levels** | Place work on CPU, GPU, and ANE; explore tensor layouts, batching, KV caching, quantization, fusion, parallel execution, and prefix reuse. |

The main track follows the operation order in [Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762): ReLU FFNs, additive sinusoidal positions and **Post-LN**, including both the encoder and decoder. Basic operators use two features; complete layers use **four features, two heads and one layer** so repeated normalization still leaves visible feature differences. LayerNorm uses scale 1 and shift 0, FFN biases are zero, and inference disables dropout. The fixed weights are for learning, not a trained translation model. The final generation-loop exercise uses a separate transition table to explain control flow.

The later puzzles add memory and execution-cost constraints to the numerical goals. A correct circuit is the starting point; choosing where and how it runs becomes part of the puzzle.

## How to play

| Action | Control |
| --- | --- |
| Connect modules | Click a **round output port**, then a **square input port**, or drag between them. |
| Delete a wire | Click the wire (or its connected input port), then **Delete wire**. **Delete / Backspace** also removes the selected wire. |
| Delete a module | In construction levels, click a module, then **Delete module** beside it. Undo restores the module and its wires. |
| Arrange the workbench | Drag a module to move it. |
| Build from the shelf | Drag a module card onto the table; its 3D preview follows your cursor. Click a card, then a free spot as an alternative. **Return module** removes that copy and its wires. |
| Explore the scene | Drag empty space to rotate; scroll to zoom. During a run, dragging the workbench or a module rotates the view without moving the module. |
| Inspect a module | Double-click it on the workbench or shelf to open its card. Shelf previews work even when stock is exhausted; Enter also opens a focused shelf item. |
| Test your circuit | Click **Run my network** and watch the vectors move. |
| Pause a run | Click **Pause** beside the run button. Rotate or zoom while frozen, then click **Resume** to continue from the same moment. |
| Finish a level | After all inputs pass, choose **Replay level** to return to your current circuit, or **Next level**. Replay keeps all modules and wires; click **Run my network** when ready. |
| Change levels | Open the level menu. Unfinished circuits are saved; completed prologues reopen as fresh challenges. |
| Return to the title screen | Click the **N / Neural Atelier** brand at the top left. |

The left shelf starts in its smallest size. Use **− / +** to resize it, **Hide shelf** to collapse it, and **Module shelf** to reopen it. Your chosen size is remembered.

The first six prologues provide fixed modules with **no wires connected**. Prologue 07, **[Take a module](https://hacking.pub/games/neural-atelier/#workshop)**, starts with an **empty table**: drag in one familiar projection and wire it yourself. From Prologue 07 onward, the shelf remains available in every track. Every subsequent Original-track lesson also starts with an empty table, even when its shelf has only one module. Drag the required components in, then wire them. Modern and engine lessons retain their prepared starts. Previously auto-filled Original boards with no connections are archived before opening an empty table; **Restore previous solution** recovers that layout. Connected boards and completed saves continue as before. Open construction levels allow multiple copies, each with independent connections. The shelf shows remaining stock and the table limit: **8** modules for the FFN, **12** for Attention, and **7** for the Transformer block. Each module type has two copies, except the FFN's four linear projections, which combine the formerly identical linear and content projection stocks. Returning a module restores its stock. Existing saves keep all copies, positions, and wires after the merge.

After completing a prologue, reopening or reloading it starts a fresh challenge. **Restore previous solution** brings back your last completed layout and wiring without running it. Unfinished attempts continue where you left off, including attempts at a level you have beaten before. **Replay level** in the completion dialog stays on your current board without resetting or running it. Original network, modern extension, and engine levels continue to load their saved circuits directly.

The FFN reuses **Linear projection** for its content branch; the card explains this role and compares it with the different weights in **Gate projection**. The modern extension track introduces **SwiGLU** after the original encoder–decoder foundations. Separate lessons cover different weights, elementwise multiplication, gating, and down projection; RMSNorm is taught before the final puzzle uses normalized input. Existing level links, circuits, and completion records stay valid after reordering.

**Settings** brings together language, animation speed, music, and volume. Language follows your browser preference unless you choose one manually. Runs start at **0.25×** by default so the computation is easy to follow; your chosen speed is remembered.

The animated title screen introduces the workbench. Music starts after you enter and pauses while the tab is in the background. You can mute it or replay the introduction from Settings.

SiLU has its own activation animation: values travel along curved channels and shrink according to their sigmoid gates. For vector projections, individual components leave the horizontal tray and align with their weight rows. Matching colors and a worked sum follow each output in turn, all at the same pace. Use the speed setting to speed up the whole animation. Drag modules to rearrange them or use **Rebuild** to start the level again.

Moving vectors share a small tray with features arranged left to right, matching the input and output racks. A sequence keeps its token rows separate. You can rotate and zoom during execution; wiring and module placement stay locked until the run stops.

Progress and circuits are saved in this browser's `localStorage`. Links such as `#wire` or `#projection` select a level; they do not share your circuit or progress. The game requires a desktop browser with WebGL 2. Mobile layouts are not supported.

## Run locally

Use **Node.js 22 or newer**:

```sh
git clone https://github.com/chainhelen/neural-atelier.git
cd neural-atelier
npm ci
npm run dev
```

Open **<http://127.0.0.1:5173/>**. On later visits, run `npm run dev` from the project directory. Refresh after editing files; press `Ctrl+C` to stop the server.

To serve the game without Node.js, use Python from the project directory:

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Use an HTTP server rather than opening `index.html` directly, because the game uses ES modules.

## Development

Neural Atelier is a **static frontend** written in HTML, CSS, and JavaScript, with a local copy of Three.js r180. There is no build step, backend, account service, or database. Node.js is used only for development and tests.

| File | Responsibility |
| --- | --- |
| `index.html`, `style.css` | Page structure and styling |
| `game.js` | Interaction, scene, wiring, run animation, and level navigation |
| `model.js` | Scalar operators, circuit validation, and introductory FFN levels |
| `campaign.js` | Later levels and miniature Transformer calculations |
| `engine-model.js` | Teaching cost model for scheduling, memory, and quantization |
| `scene-art.js`, `module-cards.js` | 3D module artwork and illustrated cards |
| `original-curriculum.js` | Original operators, bilingual lessons, encoder–decoder arithmetic and modern-track separation |
| `level-progress.js` | Local progress and circuit saves |
| `i18n.js`, `locales/en.js` | Browser-language detection and Chinese / English text |
| `shell.js`, `music.js` | Title screen, settings, and original synthesized music |
| `vendor/` | Three.js and its MIT license |

Run the checks with:

```sh
npm test
```

Tests cover level solutions, arithmetic, saved progress, level links, settings, and animation state. DOM and scene tests use LinkeDOM and a stub renderer; visual changes and pointer interactions also need a browser check. GitHub Actions runs the tests on pushes and pull requests.

Ideas, bug reports, and pull requests are welcome. For gameplay bugs, include the level URL, browser, reproduction steps, and a screenshot when useful. For a new mechanic, start with a small playable example so its interaction can be tried early.

## Static hosting

Serve the root HTML, CSS, and JavaScript files together with **`locales/` and `vendor/`**. No `node_modules/`, test files, Git data, or development server is needed in production.

Relative asset paths and hash-based level navigation support subdirectories such as `/games/neural-atelier/` without an application-route fallback. Nginx, GitHub Pages, and other static hosts work.

If your web server serves a Git checkout directly, update it from the repository directory:

```sh
git pull --ff-only
```

There is no build step or service restart. Refresh the browser after pulling. Configure the web server to deny hidden paths (including `.git/`) and revalidate HTML, CSS, and JavaScript with `Cache-Control: no-cache`, so visitors receive updates. Keep server-specific files and credentials outside the checkout.

To enable GitHub Pages on your own copy:

1. Push the source to `main`.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. Wait for deployment and open the URL shown by Pages.

The repository includes `.nojekyll`; no build command or `npm run dev` process is needed on Pages. The current public demo is hosted at [hacking.pub](https://hacking.pub/games/neural-atelier/).

## What the game models

Small-matrix projection, attention, and FFN puzzles perform actual arithmetic. Hardware scheduling and performance figures use a simplified teaching model; the game does not load a large language model or access the Apple Neural Engine.

The on-device exercises draw on Kapitsa's approach to inference. The pinned reference revision, model assumptions, and limits are documented in [ENGINE_NOTES.md](ENGINE_NOTES.md).

The third-party Three.js license is preserved in [vendor/LICENSE](vendor/LICENSE).

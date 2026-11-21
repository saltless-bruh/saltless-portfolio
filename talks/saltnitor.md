Saltnitor is a Rust TUI command center for running llama.cpp on Linux with an NVIDIA GPU: telemetry, logs and service control in one binary.

**The trick it adds:** any IDE or agent that speaks the OpenAI chat API can swap models just by asking for a different one.

```
IDE or agent ──"model": "deep"──▶ Saltnitor (OpenAI-compatible endpoint)
                                       │
                                       ├─▶ VRAM oracle: warns first if the swap will not fit
                                       └─▶ llama.cpp router: evicts one model, loads the other
```

**What is on screen**

1. **Telemetry:** CPU sparklines and VRAM / RAM gauges, with GPU (`g`) and CPU (`c`) inspectors.
2. **Router tuner** (`t`): writes the tuned flags into router.ini and restarts the unit.
3. **API interrogator** (`i`): time to first token and tokens per second, shown as an estimate or n/a, never a fake 0.
4. **When it goes wrong:** `Ctrl+D` dumps the system state with tokens redacted; `Ctrl+K` stops the systemd unit, so VRAM is actually freed instead of respawning.

> **In short:** one terminal to watch the GPU, tune the model and swap it, without leaving the editor.

github.com/saltless-bruh/saltnitor

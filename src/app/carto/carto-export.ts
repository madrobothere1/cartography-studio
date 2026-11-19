import type { ToolcraftProductExportRenderer } from "@/toolcraft/runtime";

import { CartoEngine } from "./carto-gl";
import { readCartoSettings } from "./carto-values";

let exportEngine: CartoEngine | null = null;

function getExportEngine(): CartoEngine {
  if (!exportEngine || exportEngine.isLost) {
    exportEngine = new CartoEngine(new OffscreenCanvas(1, 1));
  }
  return exportEngine;
}

/** Renders the same deterministic frame as the live preview at the artifact's pixel density. */
export const cartoExportRenderer: ToolcraftProductExportRenderer = {
  baseFileName: "cartography-studio",
  renderFrame: ({ context, frame, signal, state }) => {
    signal.throwIfAborted();
    const transform = context.getTransform();
    const scale = Math.hypot(transform.a, transform.b) || 1;
    const engine = getExportEngine();
    engine.render({
      frameHeight: frame.height,
      frameWidth: frame.width,
      height: Math.max(1, Math.round(frame.height * scale)),
      settings: readCartoSettings(state.values),
      // Stills show the nodes at the start of their motion.
      time: 0,
      width: Math.max(1, Math.round(frame.width * scale)),
    });
    context.drawImage(engine.canvas, frame.x, frame.y, frame.width, frame.height);
  },
};

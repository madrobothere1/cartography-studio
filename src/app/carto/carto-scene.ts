import type { ToolcraftSceneRect } from "@/toolcraft/runtime";

type CanvasSizeState = Readonly<{
  canvas: Readonly<{ size: Readonly<{ height: number; width: number }> }>;
}>;

/** The map block is framed by the output frame, centred on the world origin. */
export function getCartoSceneRect(state: CanvasSizeState): ToolcraftSceneRect {
  const width = Math.max(1, state.canvas.size.width);
  const height = Math.max(1, state.canvas.size.height);
  return { height, width, x: -width / 2, y: -height / 2 };
}

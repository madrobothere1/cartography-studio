import { composeToolcraftApp } from "@/toolcraft/runtime/react";

import { appSchema } from "./app-schema";
import { cartoExportRenderer } from "./carto/carto-export";
import { CartoRenderer } from "./carto/carto-renderer";
import { getCartoSceneRect } from "./carto/carto-scene";

export const appComposition = composeToolcraftApp(appSchema, {
  scene: {
    canvasContent: <CartoRenderer />,
    rasterFrameRenderer: cartoExportRenderer,
    renderDefaultCanvasMedia: false,
    sceneBoundsProvider: ({ state }) => [getCartoSceneRect(state)],
  },
});

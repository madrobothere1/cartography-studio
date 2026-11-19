import { defineToolcraft, imageExportModule } from "@/toolcraft/runtime";

import appDefaults from "./app-defaults.json" with { type: "json" };
import { appIdentity } from "./app-identity";
import { cartoControlSections } from "./carto/carto-schema-sections";

export const appSchema = defineToolcraft({
  defaults: appDefaults,
  base: {
    canvas: {
      enabled: true,
      renderScale: true,
      sizing: { mode: "editable-output" },
      upload: false,
    },
    identity: appIdentity,
    panels: {
      controls: {
        sections: cartoControlSections,
        title: "Cartography Studio",
      },
    },
    toolbar: {
      history: true,
      radar: true,
      theme: true,
      zoom: true,
    },
  },
  modules: [imageExportModule()],
});

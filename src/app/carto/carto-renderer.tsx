import * as React from "react";

import {
  useToolcraft,
  useToolcraftProductSceneFrame,
  useToolcraftViewportInteractionActive,
} from "@/toolcraft/runtime/react";

import { CartoEngine, type CartoFrameInput } from "./carto-gl";
import { readCartoSettings } from "./carto-values";
import styles from "./carto-renderer.module.css";

function readRenderScale(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(2, Math.max(1, numeric)) : 2;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CartoRenderer(): React.JSX.Element {
  const { state } = useToolcraft();
  const frame = useToolcraftProductSceneFrame();
  const viewportActive = useToolcraftViewportInteractionActive();
  const mapRef = React.useRef<HTMLCanvasElement | null>(null);
  const networkRef = React.useRef<HTMLCanvasElement | null>(null);
  const mapEngineRef = React.useRef<CartoEngine | null>(null);
  const networkEngineRef = React.useRef<CartoEngine | null>(null);
  const inputRef = React.useRef<CartoFrameInput | null>(null);
  const [engineState, setEngineState] = React.useState<"initializing" | "ready" | "unavailable">(
    "initializing",
  );

  React.useEffect(() => {
    if (!mapRef.current || !networkRef.current) return;
    try {
      mapEngineRef.current = new CartoEngine(mapRef.current);
      networkEngineRef.current = new CartoEngine(networkRef.current);
      setEngineState("ready");
    } catch {
      setEngineState("unavailable");
    }
    return () => {
      mapEngineRef.current?.dispose();
      networkEngineRef.current?.dispose();
      mapEngineRef.current = null;
      networkEngineRef.current = null;
    };
  }, []);

  const settings = React.useMemo(() => readCartoSettings(state.values), [state.values]);
  const rect = frame.rect;
  const renderScale = readRenderScale(state.values["canvas.renderScale"]);
  const zoom = Math.max(0.01, state.canvas.zoom / 100);

  React.useEffect(() => {
    if (!rect || viewportActive) return;
    // Viewport gestures keep the last committed frame; the CSS transform carries the motion.
    const backing = Math.max(1, window.devicePixelRatio || 1) * renderScale * zoom;
    const input: CartoFrameInput = {
      frameHeight: rect.height,
      frameWidth: rect.width,
      height: rect.height * backing,
      settings,
      time: inputRef.current?.time ?? 0,
      width: rect.width * backing,
    };
    inputRef.current = input;
    mapEngineRef.current?.render(input, "map");
    networkEngineRef.current?.render(input, "network");
  }, [engineState, rect, renderScale, settings, viewportActive, zoom]);

  // Node motion redraws the network layer only; it pauses during viewport gestures.
  const moving = settings.nodeMotion !== "still" && engineState === "ready" && !viewportActive;
  React.useEffect(() => {
    if (!moving || prefersReducedMotion()) return;
    let request = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const input = inputRef.current;
      if (input) {
        inputRef.current = { ...input, time: input.time + Math.min(0.1, (now - last) / 1000) };
        networkEngineRef.current?.render(inputRef.current, "network");
      }
      last = now;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [moving]);

  const size = rect ? { height: `${rect.height}px`, width: `${rect.width}px` } : undefined;
  return (
    <div
      aria-label="Cartography map output"
      className={styles.surface}
      data-toolcraft-product-output="true"
      style={size}
    >
      <canvas
        className={styles.canvas}
        data-carto-canvas="true"
        data-carto-engine={engineState}
        data-render-scale={renderScale}
        ref={mapRef}
        style={size}
      />
      <canvas className={styles.network} data-carto-network="true" ref={networkRef} style={size} />
    </div>
  );
}

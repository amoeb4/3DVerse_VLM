import type { ViewSettings } from "../hooks/useViewSettings";

/**
 * The settings of the 3dverse render graph for a viewer's camera (`camera.dataJSON`): those the app
 * always wants, and those the View menu toggles. Each viewer has their own camera, so they change
 * that viewer's picture only.
 *
 * Looks rendered by 3dverse itself go here. A bloom, for instance, is one more line once the render
 * graph's name for it is known: the graph lists its settings in its description's
 * `inputDescriptor` (3dverse API, `GET /assets/render_graphs/{id}/description`; the default graph is
 * 398ee642-030a-45e7-95df-7147f6c43392), and the editor shows them on a camera.
 */
export function cameraRenderSettings({
  outlines,
  grid,
}: Pick<ViewSettings, "outlines" | "grid">) {
  return {
    ambientBRDF: true,
    ambientSpecular: true,
    filterSpecular: true,
    sharpen: true,
    edgeOutlines: outlines,
    edgeOnSelf: outlines,
    grid,
    drawGrid: grid,
  };
}

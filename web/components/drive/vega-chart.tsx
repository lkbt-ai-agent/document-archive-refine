"use client";

import { VegaLite, type VisualizationSpec } from "react-vega";

// Report 산출물의 선언형 Vega-Lite 스펙을 렌더(ai-outputs-frontend §4).
// 데이터값은 백엔드가 결정적으로 spec.data.values 에 주입해 둔다(ai-outputs-backend §5).
// SSR 비호환(canvas/DOM)이라 호출부에서 dynamic(ssr:false)로 로드한다.
const VegaChart = ({ spec }: { spec: Record<string, unknown> }) => (
  <div className="overflow-x-auto">
    <VegaLite
      spec={{ width: "container", ...spec } as VisualizationSpec}
      actions={false}
      renderer="svg"
    />
  </div>
);

export default VegaChart;

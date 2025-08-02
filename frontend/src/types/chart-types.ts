// Chart-specific type definitions for Portfolio Tracker

export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
  color?: string;
}

export interface PlotlyData {
  x: (string | number | Date)[];
  y: number[];
  type: 'scatter' | 'bar' | 'line' | 'candlestick' | 'histogram';
  mode?: 'lines' | 'markers' | 'lines+markers';
  name?: string;
  marker?: {
    color?: string | string[];
    size?: number | number[];
    line?: {
      color?: string;
      width?: number;
    };
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
  };
  fill?: 'none' | 'tozeroy' | 'tonexty' | 'toself';
  fillcolor?: string;
  opacity?: number;
  text?: string[];
  textposition?: string;
  hovertemplate?: string;
  showlegend?: boolean;
  yaxis?: string;
  open?: number[];
  high?: number[];
  low?: number[];
  close?: number[];
}

export interface PlotlyLayout {
  title?: string | {
    text: string;
    x?: number;
    xanchor?: string;
    font?: {
      size?: number;
      color?: string;
      family?: string;
    };
  };
  xaxis?: {
    title?: string;
    type?: 'linear' | 'log' | 'date' | 'category';
    autorange?: boolean;
    range?: [string | number, string | number];
    showgrid?: boolean;
    gridcolor?: string;
    showline?: boolean;
    linecolor?: string;
    tickformat?: string;
    tickangle?: number;
    dtick?: string | number;
  };
  yaxis?: {
    title?: string;
    type?: 'linear' | 'log';
    autorange?: boolean;
    range?: [number, number];
    showgrid?: boolean;
    gridcolor?: string;
    showline?: boolean;
    linecolor?: string;
    tickformat?: string;
    side?: 'left' | 'right';
    overlaying?: string;
    position?: number;
  };
  yaxis2?: {
    title?: string;
    type?: 'linear' | 'log';
    autorange?: boolean;
    range?: [number, number];
    showgrid?: boolean;
    gridcolor?: string;
    showline?: boolean;
    linecolor?: string;
    tickformat?: string;
    side?: 'left' | 'right';
    overlaying?: string;
    position?: number;
  };
  legend?: {
    x?: number;
    y?: number;
    xanchor?: string;
    yanchor?: string;
    orientation?: 'v' | 'h';
    bgcolor?: string;
    bordercolor?: string;
    borderwidth?: number;
  };
  margin?: {
    l?: number;
    r?: number;
    t?: number;
    b?: number;
    pad?: number;
  };
  autosize?: boolean;
  width?: number;
  height?: number;
  plot_bgcolor?: string;
  paper_bgcolor?: string;
  font?: {
    family?: string;
    size?: number;
    color?: string;
  };
  showlegend?: boolean;
  hovermode?: 'x' | 'y' | 'closest' | 'x unified' | 'y unified' | false;
  dragmode?: 'zoom' | 'pan' | 'select' | 'lasso' | 'orbit' | 'turntable' | false;
  annotations?: Array<{
    x: string | number;
    y: number;
    text: string;
    showarrow?: boolean;
    arrowhead?: number;
    arrowsize?: number;
    arrowwidth?: number;
    arrowcolor?: string;
    ax?: number;
    ay?: number;
    font?: {
      color?: string;
      size?: number;
    };
    bgcolor?: string;
    bordercolor?: string;
    borderwidth?: number;
  }>;
  shapes?: Array<{
    type: 'line' | 'circle' | 'rect' | 'path';
    x0?: string | number;
    y0?: number;
    x1?: string | number;
    y1?: number;
    line?: {
      color?: string;
      width?: number;
      dash?: string;
    };
    fillcolor?: string;
    opacity?: number;
  }>;
}

export interface PlotlyConfig {
  displayModeBar?: boolean;
  displaylogo?: boolean;
  modeBarButtonsToRemove?: string[];
  modeBarButtonsToAdd?: string[];
  toImageButtonOptions?: {
    format?: 'png' | 'svg' | 'jpeg' | 'webp';
    filename?: string;
    height?: number;
    width?: number;
    scale?: number;
  };
  responsive?: boolean;
  staticPlot?: boolean;
  editable?: boolean;
  autosizable?: boolean;
  scrollZoom?: boolean;
  doubleClick?: 'reset' | 'autosize' | 'reset+autosize' | false;
  showTips?: boolean;
  showAxisDragHandles?: boolean;
  showAxisRangeEntryBoxes?: boolean;
  showLink?: boolean;
  linkText?: string;
  locale?: string;
}

export interface ChartProps {
  data: PlotlyData[];
  layout?: PlotlyLayout;
  config?: PlotlyConfig;
  className?: string;
  style?: React.CSSProperties;
  useResizeHandler?: boolean;
  onInitialized?: (figure: { data: PlotlyData[]; layout: PlotlyLayout }, graphDiv: HTMLElement) => void;
  onUpdate?: (figure: { data: PlotlyData[]; layout: PlotlyLayout }, graphDiv: HTMLElement) => void;
  onPurge?: (figure: { data: PlotlyData[]; layout: PlotlyLayout }, graphDiv: HTMLElement) => void;
  onError?: (error: Error) => void;
  onRelayout?: (eventData: Record<string, unknown>) => void;
  onRestyle?: (eventData: Record<string, unknown>) => void;
  onClick?: (eventData: Record<string, unknown>) => void;
  onHover?: (eventData: Record<string, unknown>) => void;
  onUnhover?: (eventData: Record<string, unknown>) => void;
  onSelected?: (eventData: Record<string, unknown>) => void;
  onDeselect?: () => void;
  onDoubleClick?: () => void;
}

export interface ChartTheme {
  backgroundColor: string;
  textColor: string;
  gridColor: string;
  lineColors: string[];
  accentColor: string;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  volume?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}
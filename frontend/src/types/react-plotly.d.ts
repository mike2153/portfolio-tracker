declare module 'react-plotly.js' {
  import { Component } from 'react';
  
  interface PlotParams {
    data: any[];
    layout?: any;
    frames?: any[];
    config?: any;
    revision?: number;
    onInitialized?: (figure: any, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: any, graphDiv: HTMLElement) => void;
    onPurge?: (figure: any, graphDiv: HTMLElement) => void;
    onError?: (err: any) => void;
    onSelected?: (eventData: any) => void;
    onDeselect?: () => void;
    onHover?: (eventData: any) => void;
    onUnhover?: (eventData: any) => void;
    onClick?: (eventData: any) => void;
    onClickAnnotation?: (eventData: any) => void;
    onRelayout?: (eventData: any) => void;
    onRestyle?: (eventData: any) => void;
    onRedraw?: () => void;
    onAnimatingFrame?: (eventData: any) => void;
    onAnimated?: () => void;
    onTransitioning?: () => void;
    onTransitioned?: () => void;
    onSliderChange?: (eventData: any) => void;
    onSliderEnd?: (eventData: any) => void;
    onSliderStart?: (eventData: any) => void;
    onBeforeExport?: () => void;
    onAfterExport?: () => void;
    onAfterPlot?: () => void;
    onButtonClicked?: (eventData: any) => void;
    onWebGlContextLost?: () => void;
    useResizeHandler?: boolean;
    style?: React.CSSProperties;
    className?: string;
    divId?: string;
    debug?: boolean;
  }

  export default class Plot extends Component<PlotParams> {}
} 
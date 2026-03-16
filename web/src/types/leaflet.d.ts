declare module 'leaflet' {
  export * from 'leaflet/dist/leaflet';
}

declare module 'react-leaflet' {
  import { ComponentType } from 'react';
  
  export interface MapContainerProps {
    center?: [number, number];
    zoom?: number;
    style?: React.CSSProperties;
    className?: string;
    children?: React.ReactNode;
    scrollWheelZoom?: boolean;
  }
  
  export interface TileLayerProps {
    url: string;
    attribution?: string;
  }
  
  export interface CircleMarkerProps {
    center: [number, number];
    radius?: number;
    pathOptions?: {
      color?: string;
      fillColor?: string;
      fillOpacity?: number;
      weight?: number;
    };
    eventHandlers?: Record<string, (e: any) => void>;
    children?: React.ReactNode;
  }
  
  export interface PopupProps {
    children?: React.ReactNode;
  }
  
  export interface TooltipProps {
    children?: React.ReactNode;
    direction?: string;
    offset?: [number, number];
    opacity?: number;
  }
  
  export const MapContainer: ComponentType<MapContainerProps>;
  export const TileLayer: ComponentType<TileLayerProps>;
  export const CircleMarker: ComponentType<CircleMarkerProps>;
  export const Popup: ComponentType<PopupProps>;
  export const Tooltip: ComponentType<TooltipProps>;
  export const useMap: () => any;
}

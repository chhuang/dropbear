declare module 'react-simple-maps' {
  import { ComponentType } from 'react';
  
  export interface GeoProps {
    geography?: string;
    children?: React.ReactNode;
  }
  
  export interface MarkerProps {
    coordinates: [number, number];
    children?: React.ReactNode;
  }
  
  export interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    children?: React.ReactNode;
  }
  
  export interface ComposableMapProps {
    projection?: string;
    projectionConfig?: {
      scale?: number;
      center?: [number, number];
    };
    style?: React.CSSProperties;
    children?: React.ReactNode;
  }
  
  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeoProps>;
  export const Geography: ComponentType<any>;
  export const Marker: ComponentType<MarkerProps>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
}

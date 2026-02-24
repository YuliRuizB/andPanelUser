import { GeoPoint, Timestamp } from 'firebase/firestore';

export interface IRoute {
  id: string;
  active: boolean;
  description: string;
  imageUrl: string;
  kmlUrl: string;
  name: string;
  customerName: string;
  customerId: string;
  routeId?: string;
  vendorId: string;
}

export interface IStopPoint {
  id: string;
  active: boolean;
  description: string;
  geopoint: GeoPoint;
  imageUrl: string;
  name: string;
  order: number;
  rounds: IRound;
  round2MinutesSinceStart?: string;
  round3MinutesSinceStart?: string;
  round1MinutesSinceStart?: string;
}

interface IRound {
  round1?: string;
  round2?: string;
  round3?: string;
  round4?: string;
}


export interface RouteOption {
  routeId: string;
  routeName: string;
}

export interface LiveDriver {
  driverId: string;
  driver: string;
  customerId: string;
  customerName: string;
  driverConfirmationAt: Timestamp | null;
  geopoint?: { _lat: number; _long: number };
  vehicleName?: string;
  round?: string;
  active?: string | boolean;
  isConfirmed?: boolean;
  isLive?: boolean;
  isTaskIn?: boolean;
  isTaskOut?: boolean;
  isWithTrouble?: boolean;
  isRejected?: boolean;
  hasEnded?: boolean;
  lastUpdatedAt?: any;
  name?: string;
  id: string;
}

export interface MapMarkerItem {
  pos: google.maps.LatLngLiteral;
  driver: any;
  label: string;
}
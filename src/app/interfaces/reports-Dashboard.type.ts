import { GeoPoint } from 'firebase/firestore';

export interface IStopPoint {
    id: string;
    active: boolean;
    description: string;
    geopoint:GeoPoint;
    imageUrl: string;
    name: string;
    order: number;
    rounds: IRound;
  }
  
 export interface IRound {
    round1?: string;
    round2?: string;
    round3?: string;
    round4?: string;
  }
import { GeoPoint } from 'firebase/firestore';

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
    vendorId:string;
}

export interface IStopPoint {
    id: string;
    active: boolean;
    description: string;
    geopoint:GeoPoint;
    imageUrl: string;
    name: string;
    order: number;
    rounds: IRound;
    round2MinutesSinceStart? : string;
    round3MinutesSinceStart? : string;
    round1MinutesSinceStart? : string ;
}

interface IRound {
    round1?: string;
    round2?: string;
    round3?: string;
    round4?: string;
}
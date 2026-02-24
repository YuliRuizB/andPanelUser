import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  query,
  where,
  orderBy,
  limit,
} from '@angular/fire/firestore';
import { Observable, retry } from 'rxjs';
import { startOfToday } from 'date-fns';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class MapsService {
  constructor(private firestore: Firestore, private http: HttpClient) {}

  getliveBusses(customerId: string,routeId: string): Observable<any[]> {  
    
    const date = startOfToday();

    const ref = collection(this.firestore, `customers/${customerId}/program`);

    const q = query(
      ref,
      //where('routeId', '==', routeId),
      where('isLive', '==', true),
      where('startAt', '>=', date),
      orderBy('startAt', 'desc'),
    );

    return collectionData(q, { idField: 'id' }) as Observable<any[]>;
  }

 getStopsByRoute(customerId: string, routeId: string): Observable<any[]> {
  const ref = collection(this.firestore, `customers/${customerId}/routes/${routeId}/stops`);

  const q = query(
    ref,
    where('active', '==', true),
     orderBy('order', 'desc'),
  );

  return collectionData(q, { idField: 'id' }) as Observable<any[]>;
}

  public getDirectionsWithStops(stopPoints: any): Observable<any> {

    const httpOptions = {
      headers: new HttpHeaders({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }),
    };
    let api = `https://us-central1-andappssystem-c14f2.cloudfunctions.net/getDirectionsWithStops`;
    return this.http.post(api, { stopPoints: stopPoints }, httpOptions).pipe(
      retry(0),
    );
  }

getCustomersPolyLineCustomer(customerId: string, routeId: string): Observable<any[]> {
  const ref = collection(
    this.firestore,
    `customers/${customerId}/routes/${routeId}/polyline`
  );

  return collectionData(ref, { idField: 'id' }) as Observable<any[]>;
}

}

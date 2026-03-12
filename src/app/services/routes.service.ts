import { inject, Injectable } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy } from '@angular/fire/firestore';
import { addDoc, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CustomerRoute } from '../interfaces/user.type';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class RoutesService {
    private http = inject(HttpClient)
    constructor(private firestore: Firestore) { }

    async getRoutes(customerId: string) {
        const colRef = collection(this.firestore, `customers/${customerId}/routes`);
        const q = query(colRef, orderBy('name', 'asc'));

        const snap = await getDocs(q);

        return snap.docs.map((d) => {
            const data = d.data() as Omit<CustomerRoute, 'id'>;
            return { id: d.id, ...data } as CustomerRoute;
        });
    }

    async getRouteDetail(customerId: string, routeId: string) {
        const ref = doc(this.firestore, `customers/${customerId}/routes/${routeId}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) return null;
        return { id: snap.id, ...(snap.data() as any) };
    }

    async getRouteStops(customerId: string, routeId: string) {
        const colRef = collection(
            this.firestore,
            `customers/${customerId}/routes/${routeId}/stops`
        );
        const q = query(colRef, orderBy('order', 'asc'));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as any)
        }));
    }

    async updateRouteFields(customerId: string, routeId: string, payload: {
        name: string;
        description: string;
        kmzUrl: string;
    }) {
        const ref = doc(this.firestore, `customers/${customerId}/routes/${routeId}`);

        // Solo estos 3 campos
        await updateDoc(ref, {
            name: payload.name,
            description: payload.description,
            kmzUrl: payload.kmzUrl,
            updatedAt: new Date(),
        });
    }

    async updateRouteInactive(customerId: string, routeId: string, payload: {
        active: boolean;
    }) {
        const ref = doc(this.firestore, `customers/${customerId}/routes/${routeId}`);

        await updateDoc(ref, {
            active: payload.active,
            updatedAt: new Date(),
        });
    }

    async deleteRoute(routeid: string, customerId: string) {
        try {

            const ref = doc(
                this.firestore,
                `customers/${customerId}/routes/${routeid}`
            );
            await deleteDoc(ref);

        } catch (error) {
            console.error('Error eliminando ruta ' + error, error);
        }
    }

    async createRoute(customerId: string, data: any): Promise<string> {
        const colRef = collection(this.firestore, `customers/${customerId}/routes`);

        const docRef = await addDoc(colRef, {
            ...data,
            creation_date: serverTimestamp(),
        });
        return docRef.id;
    }

    async toggleActiveStopPoint(customerId: string, routeId: string, stopId: string, active: boolean) {
        const ref = doc(this.firestore, `customers/${customerId}/routes/${routeId}/stops/${stopId}`);
        await updateDoc(ref, {
            active: active,
        });
    }

    async updatePolyline(customerId: string, routeId: string): Promise<void> {

        console.log("Updating polyline for customer:", customerId, "route:", routeId);
        // Obtener stops activos ordenados
        const stopsRef = collection(
            this.firestore,
            `customers/${customerId}/routes/${routeId}/stops`
        );
        const q = query(stopsRef, orderBy('order', 'asc'));
        const snap = await getDocs(q);
        const stopPoints = snap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) }))
            .filter(sp => sp.active === true);

        if (stopPoints.length < 2) {
            console.warn("No hay suficientes puntos para generar polyline");
            return;
        }
        const coordinatesArray = stopPoints.map(sp => ({
            latitude: parseFloat(sp.latitude),
            longitude: parseFloat(sp.longitude)
        }));

        // Obtener documento polyline
        const polyRef = collection(
            this.firestore,
            `customers/${customerId}/routes/${routeId}/polyline`
        );

        const polySnap = await getDocs(polyRef);
        let polylineId: string;
        if (polySnap.empty) {
            const newDoc = await addDoc(polyRef, {
                createdAt: new Date()
            });
            polylineId = newDoc.id;
        } else {
            polylineId = polySnap.docs[0].id;
        }

        // Llamar a tu cloud function
        console.log("Calling cloud function with coordinates:");
        console.log(coordinatesArray);
        const response = await this.getDirectionsWithStops(coordinatesArray);
        console.log("Received polyline response:", response);

        await this.setPolyline(response, customerId, routeId, polylineId);
        console.log("Polyline updated successfully");
    }

    async getDirectionsWithStops(stopPoints: any[]): Promise<any> {
        const api = `https://us-central1-andappssystem-c14f2.cloudfunctions.net/getDirectionsWithStops`;
        return await firstValueFrom(
            this.http.post(api, { stopPoints })
        );
    }

    async setPolyline(vert: any, customerId: string, routeId: string, polylineId: string) {

        const polyRef = collection(
            this.firestore,
            `customers/${customerId}/routes/${routeId}/polyline`
        );

        if (!polylineId || polylineId === '-') {
            await addDoc(polyRef, vert);
        } else {
            const ref = doc(
                this.firestore,
                `customers/${customerId}/routes/${routeId}/polyline/${polylineId}`
            );

            await updateDoc(ref, vert);
        }
    }

    async createStopPoint(customerId: string, routeId: string, data: any): Promise<string> {
        const colRef = collection(this.firestore, `customers/${customerId}/routes/${routeId}/stops`);

        const docRef = await addDoc(colRef, {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return docRef.id;
    }

    async updateStopPoint(customerId: string, routeId: string, stopId: string, data: any): Promise<void> {
        const ref = doc(this.firestore, `customers/${customerId}/routes/${routeId}/stops/${stopId}`);
        await updateDoc(ref, {
            ...data
        });
    }


}
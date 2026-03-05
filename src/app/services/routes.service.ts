import { Injectable } from '@angular/core';
import { Firestore, collection, collectionData, query, orderBy } from '@angular/fire/firestore';
import { addDoc, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CustomerRoute } from '../interfaces/user.type';

@Injectable({ providedIn: 'root' })
export class RoutesService {
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
        const colRef = collection(this.firestore, `customers/${customerId}/routes/${routeId}/stops`);
        const snap = await getDocs(colRef);
        return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
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

}
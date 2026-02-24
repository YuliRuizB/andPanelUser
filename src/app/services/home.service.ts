import { Injectable } from "@angular/core";
import { collection, Firestore, Timestamp, query, where } from '@angular/fire/firestore';
import { collectionGroup, getCountFromServer, getDocs, limit } from 'firebase/firestore';
import { startOfToday } from 'date-fns';

@Injectable({ providedIn: 'root' })

export class HomeService {
    constructor(private firestore: Firestore) { }


    async getLiveBussesCountOnce(
        customerId: string
    ): Promise<number> {

        const date = startOfToday();
        const ref = collection(this.firestore, `customers/${customerId}/program`);

        const q = query(
            ref,
            where('isLive', '==', true),
            where('startAt', '>=', date)
        );

        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    }

    async getActiveRoutesCount(customerId: string): Promise<number> {
        const ref = collection(this.firestore, `customers/${customerId}/routes`);

        const q = query(
            ref,
            where('active', '==', true)
        );

        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    }

    async getActiveProductsCount(customerId: string): Promise<number> {
        const ref = collection(this.firestore, `customers/${customerId}/products`);

        const q = query(
            ref,
            where('active', '==', true)
        );

        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    }

    async getActivePromotionsCount(customerId: string): Promise<number> {
        const ref = collection(this.firestore, `customers/${customerId}/promotions`);

        const q = query(
            ref,
            where('active', '==', true)
        );

        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    }

    async getActiveUsersCount(customerId: string): Promise<number> {
        const ref = collection(this.firestore, `users`);

        const q = query(
            ref,
            //  where('active', '==', true),
            where('customerId', '==', customerId)
        );

        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    }

    async getActiveVendorCount(customerId: string): Promise<number> {
        const ref = collection(this.firestore, `vendors`);

        const q = query(
            ref,
            where('active', '==', true),
            where('customerId', '==', customerId)
        );

        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    }

    async getActiveDriversCount(customerId: string): Promise<number> {
        const ref = collection(this.firestore, `drivers`);

        const q = query(
            ref,
            where('active', '==', true),
            where('customerId', '==', customerId)
        );

        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    }

    async getActiveBoardingPassesCount(customerId: string): Promise<number> {
        const ref = collectionGroup(this.firestore, 'boardingPasses');
        const q = query(
            ref,
            where('customerId', '==', customerId),
            where('active', '==', true)
        );
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    }

    async getUsersCreatedIn2026ByMonth(): Promise<number[]> {
        // Rango: [2026-01-01, 2027-01-01)
        const start = Timestamp.fromDate(new Date('2026-01-01T00:00:00-06:00'));
        const end = Timestamp.fromDate(new Date('2027-01-01T00:00:00-06:00'));

        const colRef = collection(this.firestore, 'users');
        const q = query(
            colRef,
            where('dateTimeStamp', '>=', start),
            where('dateTimeStamp', '<', end)
        );

        const snap = await getDocs(q);

        // 12 meses
        const counts = Array(12).fill(0);

        snap.forEach((doc) => {
            const data: any = doc.data();
            const ts: Timestamp | undefined = data?.dateTimeStamp;

            if (!ts) return;

            const d = ts.toDate();               // Date real
            const monthIndex = d.getMonth();     // 0=Ene ... 11=Dic
            counts[monthIndex]++;
        });

        return counts;
    }


    async getNewUsersCounts2025ByMonth(customerId: string): Promise<number[]> {
        const colRef = collection(this.firestore as any, 'users');
        const out = Array(12).fill(0);

        for (let m = 0; m < 12; m++) {
            const month = String(m + 1).padStart(2, '0');

            // inicio del mes
            const start = `2025-${month}-01T00:00:00-06:00`;

            // inicio del siguiente mes
            const end =
                m === 11
                    ? `2026-01-01T00:00:00-06:00`
                    : `2025-${String(m + 2).padStart(2, '0')}-01T00:00:00-06:00`;

            const q = query(
                colRef,
                where('customerId', '==', customerId),
                where('dateCreateUserFull', '>=', start),
                where('dateCreateUserFull', '<', end)
            );

            const snap = await getCountFromServer(q);
            out[m] = snap.data().count;
        }

        return out;
    }

    async getNewUsersCountsByMonth(
        customerId: string,
        year: number
    ): Promise<number[]> {
        const colRef = collection(this.firestore as any, 'users');
        const out = Array(12).fill(0);

        for (let m = 0; m < 12; m++) {
            const month = String(m + 1).padStart(2, '0');

            const start = `${year}-${month}-01T00:00:00-06:00`;
            const end =
                m === 11
                    ? `${year + 1}-01-01T00:00:00-06:00`
                    : `${year}-${String(m + 2).padStart(2, '0')}-01T00:00:00-06:00`;

            const q = query(
                colRef,
                where('customerId', '==', customerId),
                where('dateCreateUserFull', '>=', start),
                where('dateCreateUserFull', '<', end)
            );

            const snap = await getCountFromServer(q);
            out[m] = snap.data().count;
        }

        return out;
    }
    async debugFindOneUserByCustomerId(customerId: string) {
        const colRef = collection(this.firestore as any, 'users');
        const q = query(colRef, where('customerId', '==', customerId), limit(1));
        const snap = await getDocs(q);      
        snap.forEach(d => console.log('sample user:', d.id, d.data()));
    }
}
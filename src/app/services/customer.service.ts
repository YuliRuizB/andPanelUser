// customers.service.ts (o como se llame tu service)
import { Injectable } from '@angular/core';
import { Firestore, collection, query, orderBy, limit as qLimit, getDocs } from '@angular/fire/firestore';
import { IBoardingPass } from '../interfaces/dashboard.type';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  constructor(private firestore: Firestore) {}

  // ✅ NUEVO PATH: users/{uid}/boardingPasses
  async getLatestUserPurchasesOnce(uid: string, max: number): Promise<IBoardingPass[]> {
    const colRef = collection(this.firestore, `users/${uid}/boardingPasses`);
    const q = query(colRef, orderBy('creation_date', 'desc'), qLimit(max));

    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data() as Omit<IBoardingPass, 'id'>;
      return { id: d.id, ...data } as IBoardingPass;
    });
  }
}

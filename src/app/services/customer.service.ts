// customers.service.ts (o como se llame tu service)
import { Injectable } from '@angular/core';
import { Firestore, collection, query, orderBy, limit as qLimit, getDocs, where, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { IBoardingPass } from '../interfaces/dashboard.type';
import { log } from 'console';

@Injectable({ providedIn: 'root' })
export class CustomersService {
  constructor(private firestore: Firestore) { }


  async getLatestUserPurchasesOnce(uid: string, max: number): Promise<IBoardingPass[]> {
    const colRef = collection(this.firestore, `users/${uid}/boardingPasses`);
    const q = query(colRef, orderBy('creation_date', 'desc'), qLimit(max));

    const snap = await getDocs(q);

    return snap.docs.map((d) => {
      const data = d.data() as Omit<IBoardingPass, 'id'>;
      return { id: d.id, ...data } as IBoardingPass;
    });
  }

  async getJobType(): Promise<any[]> {
    const colRef = collection(this.firestore, 'jobType');
    const snap = await getDocs(colRef);

    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async getUsersByCustomerOnce(accountId: string): Promise<any[]> {
    const colRef = collection(this.firestore, 'users');

    // Query simple: solo where customerId + orderBy displayName
    const q = query(
      colRef,
      where('customerId', '==', accountId),
      orderBy('displayName')
    );

    const snap = await getDocs(q);

    // si necesitas ignorar rolId vacío, lo filtras aquí sin romper Firestore
    return snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((u: any) => (u.rolId ?? '') !== '');
  }

  async getAccount(accountId: string): Promise<any> {
    const docRef = doc(this.firestore, `customers/${accountId}`);
    const snap = await getDoc(docRef);

    if (!snap.exists()) return null;

    return { id: snap.id, ...snap.data() };
  }

  async getPaymentMethods(accountId: string): Promise<any[]> {
    const colRef = collection(this.firestore, `customers/${accountId}/paymentMethods`);

    // opcional: ordenar si tienes campo "name" o "createdAt"
    const q = query(colRef, orderBy('name'));

    const snap = await getDocs(q);

    if (snap.empty) return [];

    return snap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<any, 'id'>),
    }));
  }

  updateAccount(accountId: string, updatedAccount: any) {
    const ref = doc(this.firestore, `customers/${accountId}`);
    return updateDoc(ref, updatedAccount);
  }

  updateAccountPayment(accountId: string, id: any, active: boolean) {
    const ref = doc(this.firestore, `customers/${accountId}/paymentMethods/${id}`);
    return updateDoc(ref, { active: active });
  }

   updateAvatarAccount(accountId: string, url: any) {
    const accRef = doc(this.firestore, `customers/${accountId}`);
    return updateDoc(accRef, { imageUrl: url });
  }

}

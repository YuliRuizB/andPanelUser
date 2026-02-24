// promotions.service.ts
import { Injectable } from '@angular/core';
import {
  Firestore, collection, collectionData, doc, updateDoc, addDoc, serverTimestamp,
  query, orderBy
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { Promotion } from '../interfaces/promotions.type';

@Injectable({ providedIn: 'root' })
export class PromotionsService {
  constructor(private fs: Firestore, private storage: Storage) {}

  promotions$(customerId: string): Observable<Promotion[]> {
    const col = collection(this.fs, `customers/${customerId}/promotions`);
    const q = query(col, orderBy('date_created', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Promotion[]>;
  }

  async addPromotion(customerId: string, data: Omit<Promotion, 'id' | 'customerId' | 'date_created'>) {
    const col = collection(this.fs, `customers/${customerId}/promotions`);
    return addDoc(col, {
      ...data,
      customerId,
      date_created: serverTimestamp(),
    });
  }

  async updatePromotion(customerId: string, promotionId: string, patch: Partial<Promotion>) {
    const d = doc(this.fs, `customers/${customerId}/promotions/${promotionId}`);
    return updateDoc(d, patch as any);
  }

  async uploadPromotionImage(file: File, customerId: string): Promise<string> {
    const path = `promotions/${customerId}/${Date.now()}_${file.name}`;
    const fileRef = ref(this.storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  }
}

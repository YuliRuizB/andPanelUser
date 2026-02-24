import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, updateDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { Observable, switchMap } from 'rxjs';
import { CollectionReference, deleteDoc, DocumentData, getDocs, getDocsFromServer, orderBy, query, serverTimestamp, Timestamp, where, writeBatch } from 'firebase/firestore';
import { PartialPayment, Product } from '../interfaces/product.type';
import { Functions, httpsCallable } from '@angular/fire/functions';


@Injectable({ providedIn: 'root' })
export class ProductsService {
  private fs = inject(Firestore);
  private storage = inject(Storage);
  private fns = inject(Functions);

  constructor(private firestore: Firestore) { }

  /** Path: /customers/{customerId}/products */
  private productsCol(customerId: string) {
    return collection(this.fs, `customers/${customerId}/products`);
  }

  products$(customerId: string): Observable<Product[]> {
    const colRef = this.productsCol(customerId);
    // idField agrega "id" automáticamente
    return collectionData(colRef, { idField: 'id' }) as Observable<Product[]>;
  }

  async addProduct(customerId: string, data: Partial<Product> & Record<string, any>) {
    const colRef = this.productsCol(customerId);

    // Creamos doc con id propio para que quede guardado también en el campo "id"
    const newDocRef = doc(colRef); // docRef con ID generado
    const id = newDocRef.id;

    const payload = {
      ...data,
      id,
      customerId,
      date_created: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
    };

    await setDoc(newDocRef, payload);
    return id;
  }

  async updateProduct(customerId: string, productId: string, changes: Partial<Product> & Record<string, any>) {
    const docRef = doc(this.fs, `customers/${customerId}/products/${productId}`);

    await updateDoc(docRef, {
      ...changes,
      lastUpdatedAt: serverTimestamp(),
    });
  }

  /** Upload a Storage y regresa URL */
  async uploadProductImage(file: File, customerId: string): Promise<string> {
    const safeName = file.name.replace(/\s+/g, '_');
    const path = `products1/products/${customerId}/${Date.now()}_${safeName}`;

    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  async createPartialPayments(
    customerId: string,
    productId: string,
    payments: { active: boolean; amount: number; startsAt: Timestamp; endsAt: Timestamp }[]
  ) {
    const batch = writeBatch(this.fs);

    const colRef = collection(this.fs, `customers/${customerId}/products/${productId}/partialPayment`);

    payments.forEach((p) => {
      const newRef = doc(colRef); // auto-id
      batch.set(newRef, {
        ...p,
        createdAt: Timestamp.now(),
      });
    });

    await batch.commit();
  }

  getPartialPayments(customerId: string, productId: string, onlyActive = true): Observable<PartialPayment[]> {
    const ref = collection(
      this.firestore,
      `customers/${customerId}/products/${productId}/partialPayment`
    ) as CollectionReference<DocumentData>;

    const q = onlyActive
      ? query(ref, where('active', '==', true), orderBy('startsAt', 'asc'))
      : query(ref, orderBy('startsAt', 'asc'));

    return new Observable<PartialPayment[]>((subscriber) => {
      (async () => {
        try {
          const snap = await getDocsFromServer(q);

          const data: PartialPayment[] = snap.docs.map((d) => {
            const raw = d.data() as Omit<PartialPayment, 'id'>;
            return { id: d.id, ...raw };
          });

          subscriber.next(data);
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }


  async replacePartialPayments(
    customerId: string,
    productId: string,
    payments: Omit<PartialPayment, 'id'>[]
  ) {
    const colRef = collection(this.fs, `customers/${customerId}/products/${productId}/partialPayment`);

    const batch = writeBatch(this.fs);

    // 1) borrar existentes
    const currentSnap = await getDocs(colRef);
    currentSnap.docs.forEach((d) => batch.delete(d.ref));

    // 2) crear nuevos
    payments.forEach((p) => {
      const newRef = doc(colRef); // auto-id
      batch.set(newRef, {
        ...p,
        createdAt: Timestamp.now(),
      });
    });

    await batch.commit();
  }

  async getProducts(customerId: string): Promise<any[]> {
    const colRef = collection(
      this.fs,
      `customers/${customerId}/products`
    );
    const q = query(colRef,
      where('active', '==', true)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      productId: d.id,
      ...(d.data() as any)
    }));
  }

  async getRoutes(customerId: string): Promise<any[]> {
    const colRef = collection(
      this.fs,
      `customers/${customerId}/routes`
    );

    const q = query(
      colRef,
      where('active', '==', true)
    );

    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      routeId: d.id,
      ...(d.data() as any)
    }));
  }

  async getStopPoints(
    customerId: string,
    routeId: string
  ): Promise<any[]> {
    const colRef = collection(
      this.fs,
      `customers/${customerId}/routes/${routeId}/stops`
    );

    const q = query(
      colRef,
      where('active', '==', true),
      orderBy('order', 'asc')
    );

    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      stopPointId: d.id,
      ...(d.data() as any)
    }));
  }

  private boardingPassesCol(uid: string) {
    return collection(this.fs, `users/${uid}/boardingPasses`);
  }

  /** Stream de pases (si lo ocupas) */
  boardingPasses$(uid: string): Observable<any[]> {
    const colRef = this.boardingPassesCol(uid);
    return collectionData(colRef, { idField: 'id' }) as Observable<any[]>;
  }


  async addBoardingPass(uid: string, data: any) {
    const colRef = this.boardingPassesCol(uid);

    // docRef con ID generado
    const newDocRef = doc(colRef);
    const id = newDocRef.id;

    const payload = {
      ...data,
      id,
      uid, // opcional, pero útil
      date_created: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
    };

    await setDoc(newDocRef, payload);
    return id;
  }

  /** Actualizar pase (igual que updateProduct) */
  async updateBoardingPass(uid: string, boardingPassId: string, changes: any) {
    const docRef = doc(this.fs, `users/${uid}/boardingPasses/${boardingPassId}`);

    await updateDoc(docRef, {
      ...changes,
      lastUpdatedAt: serverTimestamp(),
    });
  }

  /** Path: /users/{uid}/boardingPasses/{boardingPassId}/boardingPassesDetail */
  private boardingPassDetailCol(uid: string, boardingPassId: string) {
    return collection(this.fs, `users/${uid}/boardingPasses/${boardingPassId}/boardingPassesDetail`);
  }

  /** Crear detalle con ID propio guardado en campo "id" */
  async addBoardingPassDetail(uid: string, boardingPassId: string, data: any) {
    const colRef = this.boardingPassDetailCol(uid, boardingPassId);

    const newDocRef = doc(colRef);
    const id = newDocRef.id;

    const payload = {
      ...data,
      id,
      boardingPassId,
      date_created: serverTimestamp(),
      lastUpdatedAt: serverTimestamp(),
    };

    await setDoc(newDocRef, payload);
    return id;
  }


  async createPurchaseCloud(send: any, currentUser: any, idBoardingPass: string) {
    try {
      const fn = httpsCallable(this.fns, 'createPurchaseRequest');
      const res = await fn({
        purchaseRequestData: send,
        user: currentUser,
        idBoardingPass
      });
      return res; // res.data trae lo que retorne tu CF
    } catch (err) {
      console.log(err);

      throw err;
    }
  }

  // /users/{uid}/boardingPasses/{boardingPassId}/partialPaymentDetail
  private partialPaymentDetailCol(uid: string, boardingPassId: string) {
    return collection(this.firestore, `users/${uid}/boardingPasses/${boardingPassId}/partialPaymentDetail`);
  }

  async addPartialPaymentDetail(uid: string, boardingPassId: string, data: Omit<PartialPayment, 'id'> & { id?: string }) {
    const colRef = this.partialPaymentDetailCol(uid, boardingPassId);

    // si quieres usar un ID específico (ej. partialPaymentId del form), pásalo; si no, autogenerado
    const newDocRef = data.id ? doc(colRef, data.id) : doc(colRef);
    const id = newDocRef.id;

    const payload: PartialPayment = {
      id,
      active: data.active,
      amount: data.amount,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      paymentNumber: data.paymentNumber,
      createdAt: serverTimestamp() as unknown as Timestamp,
      idBoardingPass: boardingPassId,
      uidUser: uid,
    };

    await setDoc(newDocRef, payload);
    return id;
  }
  async getPartialPaymentDetails(uid: string, boardingPassId: string): Promise<PartialPayment[]> {
    const colRef = collection(this.firestore, `users/${uid}/boardingPasses/${boardingPassId}/partialPaymentDetail`);

    // Si quieres ordenar por createdAt o startsAt
    const q = query(colRef, orderBy('createdAt', 'desc'));

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as PartialPayment[];
  }

  async deletePartialPaymentDetail(uid: string, idBoardingPass: string, partialPaymentId: string) {
    const ref = doc(this.firestore,
      `users/${uid}/boardingPasses/${idBoardingPass}/partialPayments/${partialPaymentId}`
    );
    return deleteDoc(ref);
  }

}


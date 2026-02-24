import { Injectable } from '@angular/core';
import { CollectionReference, DocumentData, Firestore, Timestamp, addDoc, collection, collectionData, collectionGroup, deleteDoc, doc, getDocsFromServer, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from '@angular/fire/firestore';
import { CustomerRoute, User1 } from '../interfaces/user.type';
import { catchError, map, Observable, throwError } from 'rxjs';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { ToastService } from './toast.service';
import { log } from 'console';
import { PartialPayment } from '../interfaces/product.type';

@Injectable({
  providedIn: 'root'
})
export class userService {


  constructor(private firestore: Firestore, private functions: Functions, private http: HttpClient,
    private notification: ToastService
  ) { }


  getUsers(customerId: string): Observable<User1[]> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('customerId', '==', customerId));

    return new Observable<User1[]>((subscriber) => {
      (async () => {
        try {
          const snap = await getDocsFromServer(q);

          const data = snap.docs.map((d) => ({
            uid: d.id,
            ...(d.data() as Omit<User1, 'uid'>),
          })) as User1[];

          subscriber.next(data);
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }

  async updateUser(uid: string, payload: any): Promise<void> {
    const ref = doc(this.firestore, 'users', uid);
    await updateDoc(ref, payload);
  }

  getActiveRoutes(customerId: string): Observable<CustomerRoute[]> {
    const routesRef = collection(
      this.firestore,
      `customers/${customerId}/routes`
    ) as CollectionReference<DocumentData>;

    const q = query(routesRef, where('active', '==', true));

    return new Observable<CustomerRoute[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.metadata.fromCache) return;

          const routes = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as CustomerRoute[];

          subscriber.next(routes);
        },
        (err) => subscriber.error(err)
      );

      return () => unsub();
    });
  }

  getActiveRoutesMaps(customerId: string): Observable<CustomerRoute[]> {
    const ref = collection(this.firestore, `customers/${customerId}/routes`);
    const q = query(ref, where('active', '==', true));
    return collectionData(q, { idField: 'id' }) as Observable<CustomerRoute[]>;
  }

  async setMessage(data: any, idUser: string) {
    // users/{idUser}/messages
    const ref = collection(this.firestore, `users/${idUser}/messages`);
    return addDoc(ref, {
      ...data,
      timestamp: data?.timestamp ?? serverTimestamp(),
    });
  }

  getUserChatMessages(userId: string, lim = 10): Observable<any[]> {
    const ref = collection(this.firestore, 'chatMessages');
    const q = query(
      ref,
      where('uid', '==', userId),
      orderBy('createdAt', 'asc')
    );

    // idField te agrega el id sin snapshotChanges
    return collectionData(q, { idField: 'id' }) as Observable<any[]>;
  }

  async setChatMessage(data: any) {
    const ref = collection(this.firestore, 'chatMessages');
    return addDoc(ref, {
      ...data,
      createdAt: data?.createdAt ?? serverTimestamp(),
    });
  }

  // -------- FUNCTIONS (sin compat) ----------
  sendToDeviceMessage(infoToSend: any) {
    const fn = httpsCallable(this.functions, 'sendToDeviseMessage');
    return fn(infoToSend);
  }

  getUserActivityLog(userId: string): Observable<any[]> {
    const ref = collection(this.firestore, 'activityLog');
    const q = query(
      ref,
      where('userId', '==', userId),
      where('valid', '==', true),
      orderBy('createdAt', 'asc')
    );

    // idField te agrega el id sin snapshotChanges
    return collectionData(q, { idField: 'id' }) as Observable<any[]>;
  }

  getActivityLog(userId: string): Observable<any[] | any> {
    const params = new HttpParams().set('userId', userId);

    return this.http.get<any[] | any>('https://us-central1-andappssystem-c14f2.cloudfunctions.net/getActivityLog', { params }).pipe(
      catchError((err: HttpErrorResponse) => {
        const msg =
          (err.error && (err.error.message || err.error.error)) ||
          err.message ||
          'Error desconocido';

        this.notification.error(msg, 'And Informa');

        return throwError(() => err); // re-lanza el HttpErrorResponse
      })
    );
  }

  getUsersList(customerId: string): Observable<User1[]> {
    const params = new HttpParams().set('customerId', customerId);

    return this.http.get<any[] | any>('https://us-central1-andappssystem-c14f2.cloudfunctions.net/getUserByIdWithRoute?customerId=' + customerId).pipe(
      catchError((err: HttpErrorResponse) => {
        const msg =
          (err.error && (err.error.message || err.error.error)) ||
          err.message ||
          'Error desconocido';

        this.notification.error(msg, 'And Informa');

        return throwError(() => err); // re-lanza el HttpErrorResponse
      })
    );
  }

  deleteBoardingPass(userId: any, boardingPassId: any): Promise<void> {
    const ref = doc(this.firestore, `users/${userId}/boardingPasses/${boardingPassId}`);
    return deleteDoc(ref);
  }

  activatePurchase(userId: any, purchaseId: any, active: boolean): Promise<void> {
    const ref = doc(this.firestore, `users/${userId}/boardingPasses/${purchaseId}`);
    const lastUpdatedAt = Timestamp.fromDate(new Date());
    return updateDoc(ref, { active, lastUpdatedAt });
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

          const data = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PartialPayment, 'id'>),
          })) as PartialPayment[];

          subscriber.next(data);
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }

  getBoardingPassesByCustomerId(customerId: string, onlyActive = true): Observable<any[]> {
    // ✅ trae docs de TODOS los users: users/*/boardingPasses/*
    const ref = collectionGroup(this.firestore, 'boardingPasses') as CollectionReference<DocumentData>;

    // 🔎 Filtra solo por customerId (sin usuario)
    // Si en algunos docs guardaste customer_id, puedes usar OR con dos queries (te lo dejo abajo).
    const q = onlyActive
      ? query(ref, where('customerId', '==', customerId), where('active', '==', true), orderBy('validTo', 'desc'))
      : query(ref, where('customerId', '==', customerId), orderBy('validTo', 'desc'));

    return new Observable<any[]>((subscriber) => {
      (async () => {
        try {
          const snap = await getDocsFromServer(q);

          const data = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));

          subscriber.next(data);
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      })();
    });
  }
}
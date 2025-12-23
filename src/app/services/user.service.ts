import { Injectable } from '@angular/core';
import { CollectionReference, DocumentData, Firestore, collection, collectionData, doc, getDocsFromServer, onSnapshot, query, updateDoc, where } from '@angular/fire/firestore';
import { CustomerRoute, User1 } from '../interfaces/user.type';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class userService {
 

  constructor( private firestore: Firestore) {}
 

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



}

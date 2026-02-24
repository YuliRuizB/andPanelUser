import { Timestamp } from '@angular/fire/firestore';

export interface Promotion {
  id?: string;
  customerId: string;
  name: string;
  description: string;
  category?: string;
  imageUrl: string;
  active: boolean;
  validFrom: Timestamp;
  validTo: Timestamp;
  date_created: Timestamp;
}
//import * as firebase from 'firebase/app';
import { Timestamp } from 'firebase/firestore';


export interface Product {
  id: string;
  customerId?: string;
  active: boolean;
  disable?: boolean;
  name: string;
   description: string;
  category: string;
  type: string;
  transportType?: string;
  price: number;
  amountTrips?: number;
  validFrom: Timestamp;
  validTo: Timestamp;
  rangeDatePicker?: [Timestamp, Timestamp] | Timestamp[];
  isTaskIn: boolean;
  isTaskOut: boolean;
  isCalculate?: boolean;
  sits?: number;
  timesSold?: number;
  frequencies?: any | null;
  rangeWeeks?: any;
  weeks?: any[];
  date_created?: Timestamp;
  lastUpdatedAt?: Timestamp;
  imageUrl?: string;  
  member?: string;
  avatar?: string;
  isParcialPayment?: boolean;
  partialPaymentAmount?: number;
  partialPaymentsCount?: number;
}

export interface PartialPayment {
  id: string;
  active: boolean;
  amount: number;
  startsAt: Timestamp;
  endsAt: Timestamp;
  createdAt?: Timestamp;
  idBoardingPass?: string;
  uidUser?: string;
  paymentNumber?: number;
}


export const columnDefs = [
    { headerName: 'Id', field: 'uid', hide: true, sortable: true, filter: 'agTextColumnFilter' },
    { headerName: 'Nombre', field: 'name', sortable: true, filter: true },
    { headerName: 'Tipo', field: 'type', sortable: true, filter: true },
    { headerName: 'Categoría', field: 'category', sortable: true, filter: true },
    { headerName: 'Descripción', field: 'description', sortable: true, filter: true },
    { headerName: 'Válido desde', field: 'validFrom', sortable: true, filter: true },
    { headerName: 'Valido hasta', field: 'validTo', sortable: true, filter: true },
    { headerName: 'Precio', field: 'price', sortable: true, filter: true },
    { headerName: 'Mete', field: 'isTaskIn', sortable: true, filter: true },
    { headerName: 'Saca', field: 'isTaskOut', sortable: true, filter: true },
    { headerName: 'Activo', field: 'active', sortable: true, filter: true },
];

export const rowGroupPanelShow = 'always';


export interface PartialPaymentOption {
  id: string;
  active?: boolean;
  label: string;        // "18 febrero 2026 - 31 julio 2026 // $1000"
  amount: number;
  startsAt: Date;
  endsAt: Date;
  paymentNumber?: number; // opcional, para orden
}


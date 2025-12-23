//import * as firebase from 'firebase/app';
import { Timestamp } from 'firebase/firestore';

export interface Product {
    id: string;
    active: boolean;
    category: string;
    date_created: Timestamp;
    description: string;
    type: string;
    name: string;
    price: number;
    validFrom: Timestamp;
    validTo: Timestamp;
    isTaskIn: boolean;
    isTaskOut: boolean;
    timesSold?: number;
    member? : string;
    avatar?: string;
    imageUrl?:string;
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
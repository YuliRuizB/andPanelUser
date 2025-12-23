/* //import * as firebase from 'firebase/app';
import { ColDef } from 'ag-grid-community';
import { Timestamp } from 'firebase/firestore';
export const columnDefs: ColDef[] = [
  { headerName: 'Id', field: 'uid', hide:true, sortable: true, filter: 'agTextColumnFilter' },
  { headerName: 'Identificación', field: 'studentId', sortable: true, filter: 'agTextColumnFilter', aggFunc: 'count', chartDataType: 'series' },
  { headerName: 'Nombre', field: 'firstName', sortable: true, filter: true },
  { headerName: 'Nombre', field: 'lastName', sortable: true, filter: true },
  { headerName: 'Email', field: 'email', sortable: true, filter: true, cellRenderer: (params: { data: any; value: string; }) => {
    const user = params.data;
    if (user && user.emailVerified) {
      return '<span style="color: green;"><b>' + params.value + '</b></span>';
    } else {
      return params.value;
    }
  }},
  { headerName: 'Teléfono', field: 'phone', sortable: true, filter: true },
]; */

import { Timestamp } from "firebase/firestore";

export const rowGroupPanelShow = 'always';
/* 
export const gridOptions = {
  columnDefs: columnDefs,
  rowData: null,
  rowSelection: 'single',
  pagination: true,
  enableFilter: true,
  statusBar: {
    statusPanels: [
        { statusPanel: 'agFilteredRowCountComponent' },
        { statusPanel: 'agSelectedRowCountComponent' },
        { statusPanel: 'agAggregationComponent' }
      ]
  },
  enableRangeSelection: true,
  paginationPageSize: 20,
  localeText: {
    // for filter panel
    page: 'página',
    more: 'más',
    to: 'a',
    of: 'de',
    next: 'siguiente',
    last: 'último',
    first: 'primero',
    previous: 'anterior',
    loadingOoo: 'Cargando ...',
    // for set filter
    selectAll: 'Seleccionar todo',
    searchOoo: 'Buscar ...',
    blanks: 'Blanco',
    // for number filter and text filter
    filterOoo: 'Filtrar ...',
    applyFilter: 'Aplicar filtro ...',
    // for number filter
    equals: 'igual',
    notEqual: 'no es igual',
    lessThanOrEqual: 'menor que o igual',
    greaterThanOrEqual: 'mayor que o igual',
    inRange: 'en un rango',
    lessThan: 'menor que',
    greaterThan: 'mayor que',
    // for text filter
    contains: 'contiene',
    notContains: 'no contiene',
    startsWith: 'inicia con',
    endsWith: 'termina con',
    // the header of the default group column
    group: 'grupo',
    // tool panel
    columns: 'columnas',
    rowGroupColumns: 'Columnas pivote',
    rowGroupColumnsEmptyMessage: 'por favor arrastre las columnas al grupo',
    valueColumns: 'Columnas valor',
    pivotMode: 'Modo pivote',
    groups: 'grupos',
    values: 'valores',
    pivots: 'pivotes',
    valueColumnsEmptyMessage: 'arrastre columnas para agregar',
    pivotColumnsEmptyMessage: 'arrastre aquí para pivotes',
    // other
    noRowsToShow: 'no hay información',
    // enterprise menu
    pinColumn: 'anclar columna',
    valueAggregation: 'valor agregación',
    autosizeThiscolumn: 'autojustar columna',
    autosizeAllColumns: 'autoajustar todas las columnas',
    groupBy: 'agrupar por',
    ungroupBy: 'desagrupar por',
    resetColumns: 'resetear columnas',
    expandAll: 'expandir todo',
    collapseAll: 'colapsar todo',
    toolPanel: 'panel de herramientas',
    // enterprise menu pinning
    pinLeft: 'anclar <<',
    pinRight: 'anclar >>',
    noPin: 'desanclar <>',
    // enterprise menu aggregation and status panel
    sum: 'sum',
    min: 'min',
    max: 'max',
    none: 'nada',
    count: 'conteo',
    average: 'promedio',
    // standard menu
    copy: 'copiar',
    copyWithHeaders: 'copiar con encabezados',
    ctrlC: 'ctrl-C',
    paste: 'pegar',
    ctrlV: 'ctrl-V',
    export: 'Exportar',
    csvExport: 'Exportar a CSV',
    excelExport: 'Exportar a Excel'
  }
}; */

export interface ICard {
  address: string;
  allows_charge: boolean;
  allows_payouts: boolean;
  bank_code: string;
  bank_name: string;
  brand: string;
  card_number: string;
  expiration_month: number;
  expiration_year: number;
  holder_name: string;
  points_card?: boolean;
  points_type?: string;
  type: string;
}

export interface ICustomer {
  address: string;
  clabe: string;
  creation_date: Date;
  email: string;
  external_id: string;
  last_name: string;
  name: string;
  phone_number: string;
}

export interface IFee {
  amount: number;
  currency: number;
  tax: number;
}

export interface IPaymentMethod {
  barcode_url: string;
  reference: string;
  type: string;
}

export interface IBoardingPass {
  active: boolean;
  amount: number;
  authorization: number;
  card?: ICard;
  category: string;
  conciliated: boolean;
  creation_date: Date;
  currency: string;
  customer_id?: string;
  customer?: ICustomer;
  date_created: Timestamp;
  due_date?: Date;
  description: string;
  error_message: string;
  fee?: IFee;
  is_courtesy?: boolean;
  method: string;
  name: string;
  operation_date: Date;
  operation_type: string;
  order_id: string;
  payment_method?: IPaymentMethod;
  price: number;
  product_description: string;
  product_id: string;
  round: string;
  routeId: string;
  routeName: string;
  status: string;
  stopDescription: string;
  stopId: string;
  stopName: string;
  transaction_type: string;
  validFrom: Timestamp;
  validTo: Timestamp;
  realValidTo?: Date;
  isTaskIn: boolean;
  isTaskOut: boolean;
  isOpenpay?: boolean;
  paidApp?: string;
  id?: string;
  amountPayment?:string;
  typePayment?:string;
  payment?:string; 
  baja?:boolean;
}

export interface ICredential {
  active: boolean;
  disabled?: boolean;
  disabledAt?: string | Timestamp;
  disabledInstructions?: string;
  disabledResons?: string;
  disabledType?: string;
  imageUrl?: string;
  passValidation?: Object;
  path?: string;
  studentId: string;
  userId: string;
  validFrom: string | Timestamp;
  validTo: string | Timestamp;
}

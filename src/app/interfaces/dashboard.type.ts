import { Timestamp } from 'firebase/firestore';
import { GeoPoint } from 'firebase/firestore';


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

  export interface IBoardingPass {
    active: boolean;
    amount: number;
    authorization: number;
    card?: ICard;
    category: string;
    conciliated: boolean;
    creation_date: Date;
    promiseDate: Date;
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
    idBoardingPass?:string;
  }

  export interface IRound {
    round1?: string;
    round2?: string;
    round3?: string;
    round4?: string;
  }

 export interface Recibo {
    amount: number;
    amountTrips: number;
    authorization: string;
    creation_date: string;
    currentTrips: number;
    description: string;
    method: string;
    name: string;
    price: number;
    routeName: string;
    round: string;
    stopName: string;
    type: string;
    typePayment: string;
    validFrom: string;
    validTo: string;
  }



import { Timestamp } from 'firebase/firestore';
import { ICard, ICustomer, IFee, IPaymentMethod } from './classes/customers';

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
    amountPayment?: string;
    typePayment?: string;
    payment?: string;
    baja?: boolean;
    idBoardingPass?: string;
  }

  export interface UserData {
    displayName: string;
    studentId: string;
    phoneNumber: string;
    email: string;
    status: string;
    customerName: string;
    customerId: string;
    defaultRouteName: string;
    defaultRound: string;
    turno:string;
    name:string;
  }
  
  
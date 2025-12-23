import { AssignmentType } from "./assignment.type";

export interface IBaseProgram {
    id: string;
    active: boolean;
    acRequired: boolean;
    isSunday: boolean;
    isMonday: boolean;
    isTuesday: boolean;
    isWednesday: boolean;
    isThursday: boolean;
    isFriday: boolean;
    isSaturday: boolean;
    program: string;
    round: string;
    stopBeginId: string;
    stopBeginName: string;
    stopEndId: string;
    stopEndName: string;
    time: string;
    type: AssignmentType;
    customerId: string;
    vendorId: string;
    vendorName: string;
    routeId: string;
    routeName?: string;
    customerName?: string;
}

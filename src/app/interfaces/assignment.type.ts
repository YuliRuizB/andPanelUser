import { VehicleType } from './vehicle.type';

export interface IAssignment {
    id: string;
    customerName: string;
    customerId: string;
    routeName: string;
    routeId: string;
    active: boolean;
    deleted: boolean;
    round: string;
    program: string;
    type: AssignmentType;
    vehicleId: string;
    vehicleName: string;
    driverName: string;
    driverId: string;
    vehicleType: VehicleType;
    isSunday: boolean;
    isMonday: boolean;
    isTuesday: boolean;
    isWednesday: boolean;
    isThursday: boolean;
    isFriday: boolean;
    isSaturday: boolean;
}

export enum AssignmentType {
    'Permanente',
    'Temporal',
    'Viaje Especial'
}
//import * as firebase from 'firebase/app';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FieldValue } from 'firebase/firestore';

export interface IVehicle {
    id: string;
    avatar: string;
    lastService: '',
    ac: boolean;
    carMaker: string;
    model: string;
    year: number;
    chassis: string;
    doors: number;
    driver: string;
    driverId: string;
    emissions: string;
    engineType: string;
    fuelType: string;
    horsePower: number;
    insuranceAgent: string;
    insuranceAgentId: string;
    insuranceAgentPhone: string;
    insuranceValidFrom: FieldValue;
    insuranceValidTo: FieldValue;
    insuranceId: string;
    name: string;
    licensePlate: string;
    seats: number;
    deviceId: string;
    fuelTankCapacity: number;
    vendor: string;
    type: VehicleType;
    active: boolean;
    disabled: boolean;
    umas?: number;
}

export enum VehicleType {
    'Camión',
    'Camioneta',
    'Automovil'
}

export const columnDefs = [
    { headerName: 'Id', sortable: true, filter: true, field: 'chassis' },
    { headerName: 'Vehículo', sortable: true, filter: true, field: 'name' },
    { headerName: 'Placas', sortable: true, filter: true, field: 'licensePlate' },
    { headerName: 'PR', sortable: true, filter: true, field: 'driver' },
    { headerName: 'Carrocería', sortable: true, filter: true, field: 'carMaker' },
    { headerName: 'Puertas', sortable: true, filter: true, field: 'doors' },
    { headerName: 'Asientos', sortable: true, filter: true, field: 'seats' },
    { headerName: 'Modelo', sortable: true, filter: true, field: 'model' },
    { headerName: 'Motor', sortable: true, filter: true, field: 'engineType' },
    { headerName: 'Emisiones', sortable: true, filter: true, field: 'emissions' },
    { headerName: 'Combustible', sortable: true, filter: true, field: 'fuelType' },
    { headerName: 'Póliza Seguro', sortable: true, filter: true, field: 'insuranceId' },
    { headerName: 'Póliza Vence', sortable: true, filter: true, field: 'insuranceDateDue', cellRenderer: (params: any) => {
        if(!params.value) return '';
        return format((params.value).toDate(), 'dd MMMM yyyy', {
          locale: es
        });
      }
    },
    { headerName: 'Activo', sortable: true, filter: true, field: 'active', cellRenderer: (params: any) => {
        if(!params.value) return '';
        return !!params.value ? 'Si' : 'No'
      }
    },
    { headerName: 'Deshabilitado', sortable: true, filter: true, field: 'disabled', cellRenderer: (params: any) => {
        if(!params.value) return 'No';
        return !!params.value ? 'Si' : 'No'
      }
    },
  ];
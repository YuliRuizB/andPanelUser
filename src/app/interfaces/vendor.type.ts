import { ILegalAddress } from './address.type';

export interface IVendor {
    id: string;
    active: boolean;
    avatar: string;
    deleted: boolean;
    legalName: string;
    name: string;
    primaryContact: string;
    primaryEmail: string;
    primaryPhone: string;
    progress: number;
    rfc: string;
    status: string;
    website: string;
    member: string[];
    address: ILegalAddress;
}

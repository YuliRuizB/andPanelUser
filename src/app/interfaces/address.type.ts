export interface IAddress {
    street: string;
    number: string;
    address2: string;
    address3: string;
    zipcode: string;
    city: string;
    state: string;
}

export interface ILegalAddress extends IAddress {
    isSameAsAddress: boolean;
}
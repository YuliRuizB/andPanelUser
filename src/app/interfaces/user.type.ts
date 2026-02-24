export interface UserCredentials {
    id: number;
    username: string;
    password: string;
    token?: string;
}

export interface User1 {
  uid: string;

  // básicos
  email?: string;
  emailVerified: boolean;
  photoURL?: string;
  // nombres
  displayName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;

  // perfil / app
  occupation?: string;
  phoneNumber?: string;
  studentId?: string | number;

  // estado / reglas
  status?: string;
  terms?: boolean;
  turno?: string | number;
  roundTrip?: string;

  // rutas
  defaultRoute?: string;
  defaultRouteName?: string;

  // multi-tenant
  customerId?: string;
  customerName?: string;

  // (deja los tuyos extra si los sigues usando)
  roles?: string[];
  rolId?: string;
  vendorId?: string;
  paid?: boolean;
  paymentId?: string;
  defaultRound?: string;
  round?: string;
  token?: string;
}

   export enum Role {
    user = 'user',
    student = 'student',
    manager = 'manager',
    admin = 'admin'
  } 

  export enum Permission {
    canRead = 'canRead',
    canList = 'canList',
    canUpdate = 'canUpdate',
    canWrite = 'canWrite',
    canCreate = 'canCreate',
    canDelete = 'canDelete'
  }

/*   export interface Roles {
    user?: boolean;
    manager?: boolean;
    admin?: boolean;
    student?: boolean;
 }
 */

 export interface CustomerRoute {
  id: string;       // doc id
  name?: string;    // nombre visible
  active?: boolean;
}

export type UserInfoKey =
  | 'displayName'
  | 'email'
  | 'emailVerified'
  | 'firstName'
  | 'lastName'
  | 'occupation'
  | 'phoneNumber'
  | 'roundTrip'
  | 'status'
  | 'terms'
  | 'turno'
  | 'username'
  | 'studentId'
  | 'defaultRoute';
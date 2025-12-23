import { Injectable, NgZone, Type } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { User1, Permission, Role } from '../interfaces/user.type';
import * as _ from 'lodash';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import {
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    User as FirebaseUser,
} from 'firebase/auth';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {    
    role?: Role;
    private userSource = new BehaviorSubject<User1 | null>(null);
    user$ = this.userSource.asObservable();
    static RolService: readonly any[] | Type<any>;

    constructor(
        private router: Router,
        private auth: Auth,
        private firestore: Firestore,
        private ngZone: NgZone,
        private notification: ToastService,
    ) {
       
        onAuthStateChanged(this.auth, async (firebaseUser: FirebaseUser | null) => {
            if (firebaseUser) {
                const userRef = doc(this.firestore, 'users', firebaseUser.uid);
                const snap = await getDoc(userRef);

                if (snap.exists()) {
                    const data = snap.data() as User1;
                    this.userSource.next(data);
                    if (this.isBrowser()) {
                        localStorage.setItem('user', JSON.stringify(data));
                    }
                } else {
                    // Solo email si no hay info en Firestore
                    this.userSource.next({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email || '',
                        emailVerified: firebaseUser.emailVerified,
                        firstName: '',
                        lastName: '',
                        photoURL: '',
                        phoneNumber: '',
                        paid: false,
                        paymentId: '',
                        defaultRoute: '',
                        defaultRound: '',
                        rolId: '',
                        customerName: '',
                        customerId: '',
                        round: '',
                        vendorId: ''
                    });
                }
            } else {
                this.userSource.next(null);
                if (this.isBrowser()) {
                    localStorage.removeItem('user');
                }
            }
        });
    }
    isBrowser(): boolean {
        return typeof window !== 'undefined';
    }
   
    async signIn(email: string, password: string) {
        if (!email || !password) {
            this.notification.error('Escriba por favor sus datos para tener acceso', 'And Informa');
            return;
        }

        const result = await signInWithEmailAndPassword(this.auth, email, password);
        const uid = result.user.uid;

        const userRef = doc(this.firestore, 'users', uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const data = snap.data() as User1;
            this.userSource.next(data);
           
            if (!data.roles || !data.roles.includes('admin')) {
                this.notification.error('No tienes acceso a este sistema', 'And Informa');
                throw new Error('No tienes acceso a este sistema');
            }

            localStorage.setItem('user', JSON.stringify(data));
            this.router.navigate(['home']);
        } else {
            this.notification.error('No se encontraron datos de usuario en Firestore', 'And Informa');
            throw new Error('No se encontraron datos de usuario en Firestore');
        }
        return result.user;

    } catch(error: any) {       
        let message = 'Escriba por favor sus datos para tener acceso';
        if (error.code === 'auth/invalid-email') {
            message = 'Correo inválido';
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            message = 'Correo o contraseña incorrectos';
        } else if (error.code === 'auth/invalid-credential') {
            message = 'Credenciales inválidas';
        }
        this.notification.error(message, 'And Informa');
        return;
    }

    /*  return this.afAuth.signInWithEmailAndPassword(email, password)
         .then((result: any) => {
             this.ngZone.run(() => {
                 if (!result.user.emailVerified) {
                     this.notification.warning(
                         'Para continuar es necesario verificar su cuenta de correo electrónico.',
                         '¡Oops!, su cuenta no ha sido verificada',
                     );
                     // this.router.navigate(['authentication/please-verify-email']);
                 } else {
                     this.getAccessLevel(result.user.uid);
                 }
             });
         }).catch((error: any) => {
             this.notification.error(error.message, 'Error');
         }); */

    // Sign up with email/password
    signUp(form: any) {
        /*  const email = form.email;
         const password = form.password;
         return this.afAuth.createUserWithEmailAndPassword(email, password)
             .then((result: any) => {
                
                 this.setUserData(result.user, form);
                 this.sendVerificationMail();
             }).catch((error: any) => {
                 this.notification.error(error, 'Error de creación de Usuario');
             }); */
    }

    async sendVerificationMail() {
        /*  try {
             const user = await this.afAuth.currentUser;
 
             if (user) {
                 await user.sendEmailVerification();
                 this.router.navigate(['authentication/verify-email']);
                 this.notification.success('El correo ha sido enviado', 'Verificación de correo');
             } else {
                 // Handle the case when there is no logged-in user
                 this.notification.error('No hay usuario registrado', 'Error de verificación de correo');
             }
         } catch (error: any) {
             this.notification.error(error.message, 'Error de verificación de correo');
         } */
    }

    // Reset Forggot password
    forgotPassword(passwordResetEmail: string) {
        return sendPasswordResetEmail(this.auth, passwordResetEmail)
            .then(() => {
                this.notification.info('Se ha enviado un correo electrónico a su cuenta con la información necesaria para recuperar su contraseña.', 'And Informa');
            }).catch((error: any) => {
                this.notification.error(error, 'And Informa');
            });
    }

    // Sign in with Google
    googleAuth() {
        //  return this.AuthLogin(new GoogleAuthProvider());
    }

    // Auth logic to run auth providers
    /* AuthLogin(provider: any) {
        return this.afAuth.signInWithPopup(provider)
            .then((result: any) => {
                this.ngZone.run(() => {
                    this.router.navigate(['dashboard']);
                });
                this.setUserData(result.user);
            }).catch((error: any) => {
                this.notification.error(error, '¡Oops!, algo salió mal ...');
            });
    } */

    /* Setting up user data when sign in with username/password,
    sign up with username/password and sign in with social auth
    provider in Firestore database using AngularFirestore + AngularFirestoreDocument service */
    setUserData(user: any, form?: any) {
        /*  const userRef: AngularFirestoreDocument<any> = this.afs.doc(`users/${user.uid}`);
         const userData = {
             uid: user.uid,
             email: user.email,
             phoneNumber: form && form.phoneNumber ? form.phoneNumber : null,
             displayName: form.firstName + ' ' + form.lastName,//user.displayName ? user.displayName : form && form.firstName ? form.lastName : null,
             studentId: form && form.studentId ? form.studentId : null,
             photoURL: user.photoURL,
             roles: [Role.admin],
             permissions: [Permission.canRead],
             emailVerified: user.emailVerified,
             name: form.firstName,
             firstName: form.firstName,
             lastName: form.lastName,
             customerName: form.customerName,
             customerId: form.customerId,
             round: form.round,
             status: form && form.status !== undefined ? form.status : 'active',
             rolId: form && form.rolId !== undefined ? form.rolId : '54YNS3xlSLPc6UzNq2HJ',
             roundTrip: form.roundTrip,
             turno: form.turno,
             idSegment: 'JvgynF0jaP7n1S1oC7pX',
             defaultRouteName: form.defaultRouteName,
             defaultRoute: form.defaultRoute,
             defaultRound: form.defaultRound
         };
         return userRef.set(userData, {
             merge: true
         }).then((result: any) => {
             this.updateUserProfile(form);
         })
             .catch((err: any) => this.notification.error(err, 'Error..')); */
    }

    getUserFromDatabase(user: any) {
        /*  const userRef: AngularFirestoreDocument<any> = this.afs.doc(`users/${user.uid}`);
         // tslint:disable-next-line: no-shadowed-variable
         userRef.snapshotChanges().subscribe((user: any) => {
             return user.payload.data();
         }); */
    }

    updateUserData(user: any) {
        /*    const userRef: AngularFirestoreDocument<any> = this.afs.doc(`users/${user.uid}`);
           const userData = {
               emailVerified: user.emailVerified
           };
           return userRef.set(userData, {
               merge: true
           })
               .then((response: any) => this.notification.success(response, 'Actuaizacion..'))
               .catch((err: any) => this.notification.error(err, 'Error..')); */
    }

    updateUserProfile(form: { fullName: string | null | undefined; }) {
        //  const auth = getAuth();
        //const user: User | null = auth.currentUser;

        /*  if (user) {
             updateProfile(user, {
                 displayName: form && form.fullName ? form.fullName : null,
                 photoURL: 'https://example.com/jane-q-user/profile.jpg',
             }).then(() => {
                 this.notification.success('Actualizacion correcta', 'Exito ..');
             }).catch((error: any) => {
                 this.notification.error(error, 'Error ..');
             });
         } else {
             this.notification.error('No Existe un usuario loggeado en la aplicación', 'Error ..');
         } */
    }

    googleLogin() {
        const provider = new GoogleAuthProvider();
        return this.oAuthLogin(provider);
    }

    private oAuthLogin(provider: any) {
        /*  return this.afAuth.signInWithPopup(provider)
             .then((credential: any) => {
                 this.updateUserData(credential.user);
             });*/
    }

    async signOut() {
        await signOut(this.auth);
        this.userSource.next(null);
        localStorage.removeItem('user');
        this.router.navigate(['authentication/login']);
    }

    async getCustomerName(customerId: string): Promise<string> {
        try {
            const ref = doc(this.firestore, 'customers', customerId);
            const snap = await getDoc(ref);         
            
            if (snap.exists()) {
                const data = snap.data() as any;
                return data.name || 'Sin nombre';
            }

            return 'Sin empresa';
        } catch (error) {
            console.error('Error obteniendo la empresa:', error);
            return 'Sin empresa';
        }
    }
}



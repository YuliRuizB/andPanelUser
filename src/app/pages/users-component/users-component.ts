// src/app/pages/users-component/users-component.ts
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CustomerRoute, User1, UserInfoKey } from '../../interfaces/user.type';
import { userService } from '../../services/user.service';
import { AuthenticationService } from '../../services/authentication.service';
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { IBoardingPass } from '../../interfaces/dashboard.type';
import { CustomersService } from '../../services/customer.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-component.html',
})
export class UsersComponent {
  authService = inject(AuthenticationService);

  users: User1[] = [];
  filteredUsers: User1[] = [];
  pagedUsers: User1[] = [];

  nameFilter: string = '';
  emailFilter: string = '';
  studentIdFilter: string = '';

  pageSize = 80;
  currentPage = 1;
  totalItems = 0;
  totalPages = 0;
  selectedPurchase: IBoardingPass | null = null;
  purchaseActionMenuOpenId: string | null = null;

  purchaseDetailTab: 'detalle' | 'pago' | 'vigencia' | 'debug' = 'detalle';
  user: any = null;
  loading = false;
  selectedUser: User1 | null = null;
  editUser: Partial<User1> = {};
  saving = false;
  private destroy$ = new Subject<void>();
  private refresh$ = new Subject<void>();
  routes: CustomerRoute[] = [];
  routesLoading = false;
  customerId: string = "";
  latestPurchases: IBoardingPass[] = [];
  loadingLatestPurchases = false;
  private latestPurchasesReqId = 0;

  activeSection: 'usuario' | 'pases' | 'mensajes' | 'historial' | 'transferencias' = 'usuario';

  constructor(
    private userService: userService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private customersService: CustomersService,
    private notification: ToastService
  ) { }

  ngOnInit() {
    // ✅ SOLO guardamos customerId, NO cargamos usuarios aquí
    this.authService.user$
      .pipe(
        filter((u): u is User1 => !!u?.customerId),
        distinctUntilChanged((a, b) => a.customerId === b.customerId),
        tap((u) => (this.user = u)),
        map((u) => u.customerId!),
        takeUntil(this.destroy$)
      )
      .subscribe((cid) => {
        this.customerId = cid;

        // ✅ Si cambia el customer, resetea tabla
        this.users = [];
        this.filteredUsers = [];
        this.pagedUsers = [];
        this.currentPage = 1;
        this.totalItems = 0;
        this.totalPages = 0;
        this.selectedUser = null;

        this.cdr.detectChanges();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers() {
    const cid = this.customerId;
    if (!cid) {
      this.notification.warning('No se encontró customerId del usuario', 'And Informa');
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    this.userService
      .getUsers(cid)
      .pipe(take(1)) // ✅ getDocs completa, pero esto no estorba
      .subscribe({
        next: (data) => {
          this.ngZone.run(() => {
            this.users = data;
            this.filteredUsers = data;
            this.applyFilters();
            this.loading = false;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          console.error(err);
          this.ngZone.run(() => {
            this.loading = false;
            this.notification.error('Error cargando usuarios', 'And Informa');
            this.cdr.detectChanges();
          });
        },
      });
  }

  applyFilters() {
    const nameTerm = this.nameFilter.trim().toLowerCase();
    const emailTerm = this.emailFilter.trim().toLowerCase();
    const studentIdTerm = this.studentIdFilter.trim().toLowerCase();

    this.filteredUsers = this.users.filter((u) => {
      const fullName = ((u.firstName ?? '') + ' ' + (u.lastName ?? '')).toLowerCase();
      const displayName = (u.displayName ?? '').toLowerCase();
      const userEmail = (u.email ?? '').toLowerCase();
      const studentId = (u.studentId ?? '').toString().toLowerCase();

      const matchName = !nameTerm || fullName.includes(nameTerm) || displayName.includes(nameTerm);
      const matchEmail = !emailTerm || userEmail.includes(emailTerm);
      const matchStudentId = !studentIdTerm || studentId.includes(studentIdTerm);

      return matchName && matchEmail && matchStudentId;
    });

    this.currentPage = 1;
    this.computePagination();
  }

  clearFilters() {
    this.nameFilter = '';
    this.emailFilter = '';
    this.studentIdFilter = '';
    this.applyFilters();
  }

  getFullName(user: User1): string {
    if (user.firstName || user.lastName) {
      return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    }
    return user.displayName ?? '';
  }

  getRoles(user: User1): string {
    return user.roles?.join(', ') ?? '';
  }

  computePagination() {
    this.totalItems = this.filteredUsers.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedUsers = this.filteredUsers.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.computePagination();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.computePagination();
    }
  }

  get fromIndex(): number {
    if (this.totalItems === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get toIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalItems);
  }

  selectUser(u: User1) {
    this.activeSection = 'usuario';
    this.selectedUser = u;
    this.editUser = {
      uid: u.uid,
      displayName: u.displayName ?? '',
      email: u.email ?? '',
      emailVerified: !!u.emailVerified,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      occupation: u.occupation ?? '',
      phoneNumber: u.phoneNumber ?? '',
      roundTrip: u.roundTrip ?? '',
      status: u.status ?? '',
      terms: !!u.terms,
      turno: u.turno ?? '',
      username: u.username ?? '',
      studentId: (u.studentId ?? '') as any,
      defaultRoute: (u.defaultRoute ?? '') as any,
    };
    this.latestPurchasesReqId++;
    this.latestPurchases = [];
    this.loadingLatestPurchases = false;
    const customerId = this.user?.customerId ?? u.customerId;
    if (!customerId) {
      this.routes = [];
      return;
    }

    this.routesLoading = true;

    this.userService
      .getActiveRoutes(customerId)
      .pipe(take(1))
      .subscribe({
        next: (routes) => {
          this.ngZone.run(() => {
            this.routes = routes;
            this.routesLoading = false;

            const exists = this.routes.some((r) => r.name === this.editUser.defaultRoute);
            if (!exists) this.editUser.defaultRoute = '';

            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          console.error(err);
          this.ngZone.run(() => {
            this.routes = [];
            this.routesLoading = false;
            this.notification.error('Error cargando rutas', 'And Informa');
            this.cdr.detectChanges();
          });
        },
      });
  }

  async updateSelectedUser() {
    if (!this.selectedUser?.uid) return;

    this.saving = true;
    try {
      const uid = this.selectedUser.uid;

      const payload: Partial<User1> = {
        displayName: this.editUser.displayName ?? '',
        email: this.editUser.email ?? '',
        firstName: this.editUser.firstName ?? '',
        lastName: this.editUser.lastName ?? '',
        occupation: this.editUser.occupation ?? '',
        phoneNumber: this.editUser.phoneNumber ?? '',
        roundTrip: this.editUser.roundTrip ?? '',
        status: this.editUser.status ?? '',
        terms: !!this.editUser.terms,
        turno: this.editUser.turno ?? '',
        username: this.editUser.username ?? '',
        studentId: (this.editUser.studentId ?? '') as any,
        defaultRoute: (this.editUser.defaultRoute ?? '') as any,
        emailVerified: !!this.editUser.emailVerified,
      };

      await this.userService.updateUser(uid, payload);

      this.selectedUser = { ...this.selectedUser, ...payload };
      this.users = this.users.map((x) => (x.uid === uid ? { ...x, ...payload } : x));
      this.applyFilters();

      this.notification.success('Usuario actualizado', 'And Informa');
    } catch (error) {
      console.error('Error update user:', error);
      this.notification.error('No se pudo actualizar el usuario', 'And Informa');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  isBooleanField(key: UserInfoKey) {
    return key === 'emailVerified' || key === 'terms' || key === 'roundTrip';
  }

  setSection(section: 'usuario' | 'pases' | 'mensajes' | 'historial' | 'transferencias') {
    this.ngZone.run(() => {
      this.activeSection = section;

      if (section === 'pases' && this.selectedUser?.uid) {
        this.getLatestPurchases(this.selectedUser.uid);
      }

      this.cdr.detectChanges();
    });
  }

  async getLatestPurchases(userId: string) {
    const reqId = ++this.latestPurchasesReqId;

    this.loadingLatestPurchases = true;
    this.latestPurchases = [];
    this.cdr.detectChanges();

    try {
      const data = await this.customersService.getLatestUserPurchasesOnce(userId, 10);

      if (reqId !== this.latestPurchasesReqId) return;

      this.ngZone.run(() => {
        this.latestPurchases = data ?? [];
        this.loadingLatestPurchases = false;
        this.cdr.detectChanges();
      });
    } catch (err) {
      console.error(err);
      if (reqId !== this.latestPurchasesReqId) return;

      this.ngZone.run(() => {
        this.latestPurchases = [];
        this.loadingLatestPurchases = false;
        this.notification.error('Error cargando pases', 'And Informa');
        this.cdr.detectChanges();
      });
    }
  }

  boardingPassSelected(p: IBoardingPass) {
    this.selectedPurchase = p;
    this.purchaseDetailTab = 'detalle';
    this.purchaseActionMenuOpenId = null;
    this.cdr.detectChanges();
  }

  togglePurchaseMenu(p: IBoardingPass, ev: MouseEvent) {
    ev.stopPropagation();
    this.purchaseActionMenuOpenId = (this.purchaseActionMenuOpenId === (p.id ?? p.idBoardingPass ?? ''))
      ? null
      : (p.id ?? p.idBoardingPass ?? '');
    this.cdr.detectChanges();
  }

  setPurchaseDetailTab(tab: 'detalle' | 'pago' | 'vigencia' | 'debug') {
    this.purchaseDetailTab = tab;
    this.cdr.detectChanges();
  }

  // Acciones del menú (engancha aquí tu lógica real)
  editPurchase(p: IBoardingPass, ev?: MouseEvent) {
    ev?.stopPropagation();
    console.log('Editar', p);
  }
  deletePurchase(p: IBoardingPass, ev?: MouseEvent) {
    ev?.stopPropagation();
    console.log('Eliminar', p);
  }
  activatePurchase(p: IBoardingPass, active: boolean, ev?: MouseEvent) {
    ev?.stopPropagation();
    console.log(active ? 'Activar' : 'Suspender', p);
  }

  selectPurchase(purchase: any) {
  this.selectedPurchase = purchase;
  this.purchaseDetailTab = 'detalle'; // tab por defecto
}

}

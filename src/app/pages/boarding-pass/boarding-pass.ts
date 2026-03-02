import { ChangeDetectorRef, Component, inject, NgZone } from '@angular/core';
import { IBoardingPass } from '../../interfaces/dashboard.type';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthenticationService } from '../../services/authentication.service';
import { userService } from '../../services/user.service';
import { distinctUntilChanged, filter, map } from 'rxjs';
import { ProductsService } from '../../services/products.service';
import { ToastService } from '../../services/toast.service';
import { firstValueFrom } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';
import { log } from 'console';


type IBoardingPassEx = IBoardingPass & {
  isParcialPayment?: boolean;
};

@Component({
  selector: 'app-boarding-pass',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './boarding-pass.html',
  styleUrls: ['./boarding-pass.css'],
})
export class BoardingPassComponent {
  activeTab: 'activos' | 'parcialidades' | 'inactivos' = 'activos';
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthenticationService);
  private userService = inject(userService);
  private ngZone = inject(NgZone);
  private productsService = inject(ProductsService);
  filterForm = this.fb.group({
    q: [''],
  });
  allInactive: IBoardingPassEx[] = [];
  inactiveFiltered: IBoardingPassEx[] = [];
  currentPageInactivos = 1;

  loading = false;
  errorMsg = '';
  tab: 'activos' | 'parcialidades' | 'inactivos' = 'activos';
  customerId = '';
  allActive: IBoardingPassEx[] = [];
  activeFiltered: IBoardingPassEx[] = [];

  partialActive: IBoardingPassEx[] = [];
  partialFiltered: IBoardingPassEx[] = [];
  pageSize = 10;

  currentPageActivos = 1;
  currentPageParciales = 1;
  showAddPartialPaymentModal = false;
  isLoadingPartialPayments = false;

  selectedPurchase: IBoardingPassEx | null = null;
  selectedAvailablePaymentId = '';
  openedRowMenu: string | null = null;

  partialPayments: any[] = [];
  availablePartialPayments: any[] = [];
  partialPaymentsOfProduct: any[] = [];
  generatedPartialPaymentsCount = 0;
  showUserInfoModal = false;
  showPaymentHistoryModal = false;

  selectedUserInfo: {
    username?: string;
    studentId?: number | string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email?: string;
    phoneNumber?: string;
  } | null = null;

  showMessageUserModal = false;
  isSendingMessage = false;
  messageTarget: { uid?: string; displayName?: string; token?: string } | null = null;
  messageForm = {
    title: '',
    description: '',
  };
  nextEndsAt: any = null;
  readonly myUid = 'FyXKSXsUbYNtAbWL7zZ66o2f1M92';


  constructor(private notification: ToastService,) {

  }

  ngOnInit() {
    this.authService.user$
      .pipe(
        filter((u: any) => !!u?.customerId),
        map((u: any) => u.customerId as string),
        distinctUntilChanged()
      )
      .subscribe((cid) => {
        this.customerId = cid;
        this.loadBoardingPasses();
      });

    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  setTab(t: 'activos' | 'parcialidades' | 'inactivos') {
    this.tab = t;
    if (t === 'activos') this.currentPageActivos = 1;
    else if (t === 'parcialidades') this.currentPageParciales = 1;
    else this.currentPageInactivos = 1;

    this.applyFilters();
  }

  reload() {
    this.loadBoardingPasses();
  }

  private loadBoardingPasses(): void {
    if (!this.customerId) return;

    this.loading = true;
    this.errorMsg = '';

    this.userService.getBoardingPassesByCustomerId(this.customerId, true).subscribe({
      next: (rows: any[]) => {
        this.ngZone.run(() => {
          const normalized = (rows || []).map((p: any) => this.normalizePass(p));
          this.allActive = normalized.filter(x => (x as any).active !== false); // default true si no existe
          this.allInactive = normalized.filter(x => (x as any).active === false);
          this.partialActive = this.allActive.filter(x => x.isParcialPayment === true);

          this.applyFilters();
          this.loading = false;

          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        console.error(err);
        this.ngZone.run(() => {
          this.allActive = [];
          this.partialActive = [];
          this.allInactive = [];
          this.applyFilters();
          this.loading = false;
          this.errorMsg = 'No se pudieron cargar los pases.';

          this.cdr.markForCheck();
        });
      },
    });
  }

  private normalizePass(raw: any): IBoardingPassEx {
    return {
      ...(raw as IBoardingPass),
      name: raw?.name ?? '',
      routeName: raw?.routeName ?? '',
      status: raw?.status ?? '',
      currency: raw?.currency || 'MXN',
      isParcialPayment: raw?.isParcialPayment === true,
    };
  }

  applyFilters(): void {
    const q = (this.filterForm.value.q || '').trim().toLowerCase();

    const match = (p: IBoardingPassEx) => {
      if (!q) return true;
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.routeName || '').toLowerCase().includes(q) ||
        (p.status || '').toLowerCase().includes(q)
      );
    };

    this.activeFiltered = this.allActive.filter(match);
    this.inactiveFiltered = this.allInactive.filter(match);
    this.partialFiltered = this.partialActive.filter(match);

    const sortByValidTo = (a: any, b: any) => {
      const da = this.toJsDate(a.validTo)?.getTime() || 0;
      const db = this.toJsDate(b.validTo)?.getTime() || 0;
      return da - db;
    };

    this.activeFiltered.sort(sortByValidTo);
    this.partialFiltered.sort(sortByValidTo);
    this.inactiveFiltered.sort(sortByValidTo);

    this.cdr.detectChanges();
    this.currentPageActivos = 1;
    this.currentPageParciales = 1;
    this.currentPageInactivos = 1;
    this.cdr.markForCheck();
  }

  toJsDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') return v.toDate();
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  private toNumber(v: any): number {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  statusBadgeClass(status: string) {
    if (status === 'completed') return 'bg-cyan-100 text-cyan-800';
    if (status === 'partial') return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-700';
  }

  statusLabel(p: IBoardingPassEx): string {
    if (p.status === 'completed' && p.is_courtesy) return 'Cortesía';
    if (p.status === 'completed') return 'Pagado';
    return 'Pago Parcial';
  }

  amountPaymentAsNumber(p: IBoardingPassEx): number {
    const v: any = (p as any)?.amountPayment;
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  getUserDisplayName(p: any): string {
    if (!p?.user) return '--';

    return (
      p.user?.displayName ||
      p.user?.username ||
      p.user?.name ||
      '--'
    );
  }

  getUserStudentId(p: any): string {
    if (!p?.user) return '--';

    const id =
      p.user?.studentId ??
      p.user?.studentID ??
      p.user?.matricula;

    if (id === null || id === undefined || id === '') return '--';

    return String(id);
  }

  get totalPagesActivos(): number {
    return Math.max(1, Math.ceil(this.activeFiltered.length / this.pageSize));
  }

  get totalPagesParciales(): number {
    return Math.max(1, Math.ceil(this.partialFiltered.length / this.pageSize));
  }

  get pagedActivos() {
    const start = (this.currentPageActivos - 1) * this.pageSize;
    return this.activeFiltered.slice(start, start + this.pageSize);
  }

  get pagedParciales() {
    const start = (this.currentPageParciales - 1) * this.pageSize;
    return this.partialFiltered.slice(start, start + this.pageSize);
  }

  get fromIndex(): number {
    const total = this.totalItems;
    if (total === 0) return 0;

    const page =
      this.tab === 'activos' ? this.currentPageActivos :
        this.tab === 'parcialidades' ? this.currentPageParciales :
          this.currentPageInactivos;

    return (page - 1) * this.pageSize + 1;
  }

  get toIndex(): number {
    const total = this.totalItems;
    if (total === 0) return 0;

    const page =
      this.tab === 'activos' ? this.currentPageActivos :
        this.tab === 'parcialidades' ? this.currentPageParciales :
          this.currentPageInactivos;

    return Math.min(page * this.pageSize, total);
  }

  get totalItems(): number {
    if (this.tab === 'activos') return this.activeFiltered.length;
    if (this.tab === 'parcialidades') return this.partialFiltered.length;
    return this.inactiveFiltered.length;
  }

  prevPage() {
    if (this.tab === 'activos') {
      if (this.currentPageActivos > 1) this.currentPageActivos--;
    } else if (this.tab === 'parcialidades') {
      if (this.currentPageParciales > 1) this.currentPageParciales--;
    } else {
      if (this.currentPageInactivos > 1) this.currentPageInactivos--;
    }
  }

  nextPage() {
    if (this.tab === 'activos') {
      if (this.currentPageActivos < this.totalPagesActivos) this.currentPageActivos++;
    } else if (this.tab === 'parcialidades') {
      if (this.currentPageParciales < this.totalPagesParciales) this.currentPageParciales++;
    } else {
      if (this.currentPageInactivos < this.totalPagesInactivos) this.currentPageInactivos++;
    }
  }
  getValidToState(p: any): 'expired' | 'today' | 'future' {
    const d = this.toJsDate(p.validTo);
    if (!d) return 'future';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    if (target.getTime() < today.getTime()) return 'expired';
    if (target.getTime() === today.getTime()) return 'today';
    return 'future';
  }

  getValidToClass(p: any): string {
    const state = this.getValidToState(p);

    if (state === 'expired') return 'text-red-600 font-semibold';
    if (state === 'today') return 'text-amber-600 font-semibold';
    return 'text-emerald-600 font-semibold';
  }

  async openAddPartialPaymentFromReport(p: any) {
    this.selectedPurchase = p;
    this.selectedAvailablePaymentId = '';
    this.partialPayments = [];
    this.availablePartialPayments = [];
    this.isLoadingPartialPayments = true;
    this.openedRowMenu = null;

    try {

      this.partialPayments = await firstValueFrom(
        this.productsService.getPartialPayments(p.customerId, p.product_id)
      );
      const partialPaymentsofProduct =
        await this.productsService.getPartialPaymentDetails(p.uid, p.idBoardingPass);

      this.generatedPartialPaymentsCount = partialPaymentsofProduct.length;
      const generatedNumbers = new Set(
        partialPaymentsofProduct.map(x => x.paymentNumber)
      );

      this.availablePartialPayments =
        this.partialPayments.filter(x => !generatedNumbers.has(x.paymentNumber));

      this.showAddPartialPaymentModal = true;
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
      this.notification.error('No se pudieron cargar las parcialidades.', 'And Informa');
    } finally {
      this.isLoadingPartialPayments = false;
      this.cdr.detectChanges();
    }
  }

  toggleRowMenu(p: any) {
    const id = p.idBoardingPass;
    this.openedRowMenu = this.openedRowMenu === id ? null : id;
  }

  openMessageUser(p: any) {
    const u = p?.user;
    if (!u?.uid) {
      this.notification.error('Este registro no trae uid del usuario.', 'And Informa');
      return;
    }

    this.messageTarget = u;
    this.messageForm = { title: '', description: '' };

    setTimeout(() => {
      this.showMessageUserModal = true;
      this.cdr.markForCheck();
    }, 0);
  }


  closeMessageUserModal() {
    setTimeout(() => {
      this.showMessageUserModal = false;
      this.isSendingMessage = false;
      this.messageTarget = null;
      this.messageForm = { title: '', description: '' };
      this.cdr.markForCheck();
    }, 0);
  }

  async sendMessageUserModal() {
    if (!this.messageTarget?.uid) {
      this.notification.error('Selecciona un usuario para enviar mensajes', 'And Informa');
      return;
    }

    const title = this.messageForm.title.trim();
    const msg = this.messageForm.description.trim();

    if (!title || !msg) {
      this.notification.warning('Completa título y descripción.', 'And Informa');
      return;
    }

    try {
      this.isSendingMessage = true;

      const requestId = 'suhB7YFAh6PYXCRuJhfD';

      const dataMessage = {
        createdAt: new Date(),
        from: this.myUid,
        fromName: 'Apps And Informa',
        msg,
        title,
        requestId,
        token: this.messageTarget.token ?? '',
        uid: this.messageTarget.uid,
        result: ''
      };

      const notifMessage = {
        timestamp: new Date(),
        title,
        from: this.myUid,
        requestId,
        body: msg,
        token: this.messageTarget.token ?? '',
        uid: this.messageTarget.uid
      };

      if (this.messageTarget.token) {
        this.userService.setMessage(notifMessage, this.messageTarget.uid);
      }

      await this.userService.setChatMessage(dataMessage);

      this.notification.success('Mensaje enviado.', 'And Informa');
      this.closeMessageUserModal();
    } catch (e) {
      console.error(e);
      this.notification.error('No se pudo enviar el mensaje.', 'And Informa');
    } finally {
      this.isSendingMessage = false;
      this.cdr.markForCheck();
    }
  }

  openUserInfo(p: any) {
    try {

      const c = p?.user || {};

      this.selectedUserInfo = {
        username: c.username ?? c.name ?? '',
        studentId: c.studentId ?? '',
        firstName: c.firstName ?? '',
        lastName: c.last_name ?? c.lastName ?? '',
        displayName: c.displayName ?? c.name ?? '',
        email: c.email ?? '',
        phoneNumber: c.phone_number ?? c.phoneNumber ?? '',
      };

      this.showUserInfoModal = true;
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
      this.notification.error('No se pudo cargar la información del usuario.', 'And Informa');
    }
  }

  closeUserInfoModal() {
    this.showUserInfoModal = false;
    this.selectedUserInfo = null;
  }

  async confirmAddPartialPaymentModal() {
    const chosen = this.availablePartialPayments.find(x => x.id === this.selectedAvailablePaymentId);
    if (!chosen) {
      this.notification.warning('Selecciona un pago', 'And Informa');
      return;
    }
    const orderedPayments = [...this.availablePartialPayments]
      .sort((a, b) => Number(a.paymentNumber) - Number(b.paymentNumber));

    const currentIndex = orderedPayments.findIndex(p => p.id === chosen?.id);

    let nextEndsAt: any = null;

    if (currentIndex !== -1 && currentIndex < orderedPayments.length - 1) {
      nextEndsAt = orderedPayments[currentIndex + 1].endsAt;
    } else {
      nextEndsAt = chosen?.endsAt;
    }

    const purchase = this.selectedPurchase as any;
    if (!purchase?.uid || !purchase?.idBoardingPass) {
      this.notification.error('Faltan datos de la compra (uid/idBoardingPass).', 'And Informa');
      return;
    }
    console.log(nextEndsAt, chosen.endsAt);

    try {
      const addAmount = this.toNumber(chosen.amount);

      const newPartialPayment = {
        id: chosen.id,
        active: true,
        amount: addAmount,
        startsAt: chosen.startsAt,
        endsAt: nextEndsAt,
        paymentNumber: Number(chosen.paymentNumber),
        createdAt: Timestamp.fromDate(new Date()),
      };

      await this.productsService.addPartialPaymentDetail(
        purchase.uid,
        purchase.idBoardingPass,
        newPartialPayment
      );

      const newAmount = this.toNumber(purchase.amount) + addAmount;
      const newAmountPayment = this.toNumber(purchase.amountPayment) + addAmount;
      const newPartialPaymentAmount = this.toNumber(purchase.partialPaymentAmount) + addAmount;
      const newValidTo = chosen.endsAt.toDate().toISOString().slice(0, 10);

      await this.productsService.updateBoardingPass(purchase.uid, purchase.idBoardingPass, {
        amount: newAmount,
        amountPayment: newAmountPayment,
        partialPaymentAmount: newPartialPaymentAmount,
        validTo: nextEndsAt,
        endsAt: nextEndsAt,
        partialPaymentId: chosen.id,
        partialPaymentAmountSelected: addAmount,
      });

      this.partialPayments = [...this.partialPayments, newPartialPayment];

      this.availablePartialPayments = this.availablePartialPayments.filter(p => p.id !== chosen.id);
      this.selectedAvailablePaymentId = '';
      this.selectedPurchase = {
        ...purchase,
        amount: newAmount,
        amountPayment: newAmountPayment,
        partialPaymentAmount: newPartialPaymentAmount,
        validTo: nextEndsAt,
        endsAt: nextEndsAt,
        partialPaymentId: chosen.id,
        partialPaymentAmountSelected: addAmount,
      };

      const updated = this.selectedPurchase as any;

      this.allActive = this.allActive.map(x =>
        (x as any).idBoardingPass === updated.idBoardingPass ? ({ ...x, ...updated }) : x
      );
      this.partialActive = this.partialActive.map(x =>
        (x as any).idBoardingPass === updated.idBoardingPass ? ({ ...x, ...updated }) : x
      );

      this.applyFilters();

      this.showAddPartialPaymentModal = false;
      this.cdr.detectChanges();

      this.notification.success('Pago parcial agregado.', 'And Informa');
    } catch (e) {
      console.error('confirmAddPartialPaymentModal', e);
      this.notification.error('No se pudo agregar el pago parcial.', 'And Informa');
    }
  }

  cancelAddPartialPaymentModal() {
    this.showAddPartialPaymentModal = false;
    this.selectedAvailablePaymentId = '';
    this.availablePartialPayments = [];
    this.partialPayments = [];
    this.selectedPurchase = null;
    this.cdr.detectChanges();
  }

  async disablePass(p: any, ev?: MouseEvent) {
    ev?.stopPropagation();
    this.openedRowMenu = null;

    const id = (p?.id ?? p?.idBoardingPass) as string;
    if (!id) {
      this.notification.error('No tengo id del pase para suspenderlo.', 'And Informa');
      return;
    }

    const ok = confirm(`¿Suspender el pase "${p?.name ?? ''}"?`);
    if (!ok) return;

    try {
      // Opción recomendada: campo active
      await this.productsService.suspendByBoardingPassId(id);

      this.ngZone.run(() => {
        this.notification.success('Pase suspendido.', 'And Informa');
        this.allActive = this.allActive.filter(x => {
          const xid = (x.id ?? (x as any).idBoardingPass) as string;
          return xid !== id;
        });

        this.partialActive = this.partialActive.filter(x => {
          const xid = (x.id ?? (x as any).idBoardingPass) as string;
          return xid !== id;
        });
        if (this.selectedPurchase) {
          const sid = (this.selectedPurchase.id ?? (this.selectedPurchase as any).idBoardingPass) as string;
          if (sid === id) this.selectedPurchase = null;
        }

        this.applyFilters();
        this.cdr.detectChanges();
      });

    } catch (e: any) {
      console.error(e);
      this.notification.error(e?.message ?? 'No se pudo suspender el pase.', 'And Informa');
    }
  }

  deletePass(p: any, ev?: MouseEvent) {
    ev?.stopPropagation();
    this.openedRowMenu = null;
    const uid = p?.user?.uid || p?.uid || p?._userId;
    if (!uid) {
      this.notification.error('No tengo uid del usuario para borrar el pase.', 'And Informa');
      return;
    }

    const id = (p?.id ?? p?.idBoardingPass) as string;
    if (!id) {
      this.notification.error('No tengo id del pase para borrarlo.', 'And Informa');
      return;
    }

    const ok = confirm(`¿Seguro que deseas BORRAR el pase "${p?.name ?? ''}"?\nEsta acción no se puede deshacer.`);
    if (!ok) return;

    this.userService.deleteBoardingPass(uid, id)
      .then(() => {
        this.ngZone.run(() => {
          this.notification.success('¡Boarding pass eliminado!', 'And Informa');

          this.allActive = this.allActive.filter(x => (x.id ?? (x as any).idBoardingPass) !== id);
          this.partialActive = this.partialActive.filter(x => (x.id ?? (x as any).idBoardingPass) !== id);

          this.applyFilters();
          this.cdr.markForCheck();
        });
      })
      .catch(err => {
        console.error(err);
        this.ngZone.run(() => this.notification.error(err, 'And Informa'));
      });
  }

  get totalPagesInactivos(): number {
    return Math.max(1, Math.ceil(this.inactiveFiltered.length / this.pageSize));
  }

  get pagedInactivos() {
    const start = (this.currentPageInactivos - 1) * this.pageSize;
    return this.inactiveFiltered.slice(start, start + this.pageSize);
  }

  computeNextEndsAt(): void {
    const chosen = this.availablePartialPayments.find(p => p.id === this.selectedAvailablePaymentId);

    if (!chosen) {
      this.nextEndsAt = null;
      return;
    }

    // Ordenar por paymentNumber (robusto aunque vengan desordenados)
    const ordered = [...this.availablePartialPayments].sort(
      (a, b) => Number(a.paymentNumber) - Number(b.paymentNumber)
    );

    const idx = ordered.findIndex(p => p.id === chosen.id);

    // Si hay siguiente, usamos su endsAt; si no, usamos el del chosen
    this.nextEndsAt =
      (idx !== -1 && idx < ordered.length - 1)
        ? ordered[idx + 1].endsAt
        : chosen.endsAt;
  }

 async openPaymentHistory(p: any) {
  this.openedRowMenu = null;

  // Si necesitas, guarda el registro actual
  this.selectedPurchase = p;
this.partialPaymentsOfProduct =
        await this.productsService.getPartialPaymentDetails(p.uid, p.idBoardingPass);


  this.showPaymentHistoryModal = true;
}

closePaymentHistoryModal() {
  this.showPaymentHistoryModal = false;
}

}
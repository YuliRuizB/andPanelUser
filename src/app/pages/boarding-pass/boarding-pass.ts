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
  activeTab: 'activos' | 'parcialidades' = 'activos';
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthenticationService);
  private userService = inject(userService);
  private ngZone = inject(NgZone);
  private productsService = inject(ProductsService);
  // filtros simples (por ahora solo texto)
  filterForm = this.fb.group({
    q: [''],
  });

  // Data
  loading = false;
  errorMsg = '';
  tab: 'activos' | 'parcialidades' = 'activos';
  // "Todos" (activos)
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

  partialPayments: any[] = [];          // tipa con tu PartialPayment si ya lo tienes
  availablePartialPayments: any[] = [];


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

    // 2) filtros reactivos
    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  setTab(t: 'activos' | 'parcialidades') {
    this.tab = t;

    // opcional: al cambiar tab, volver a página 1 de ese tab
    if (t === 'activos') this.currentPageActivos = 1;
    else this.currentPageParciales = 1;

    this.applyFilters();
  }

  reload() {
    this.loadBoardingPasses();
  }

  private loadBoardingPasses(): void {
    if (!this.customerId) return;

    this.loading = true;
    this.errorMsg = '';
    this.cdr.detectChanges();

    // ✅ Solo activos (para "Todos" y para "Parcialidades")
    this.userService.getBoardingPassesByCustomerId(this.customerId, true).subscribe({
      next: (rows: any[]) => {
        console.log('Pases cargados:', rows);

        this.ngZone.run(() => {
          const normalized = (rows || []).map((p: any) => this.normalizePass(p));

          // TODOS ACTIVOS
          this.allActive = normalized;

          // PARCIALIDADES: activos + isParcialPayment true
          this.partialActive = normalized.filter((x) => x.isParcialPayment === true);

          this.applyFilters();
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error(err);
        this.ngZone.run(() => {
          this.allActive = [];
          this.partialActive = [];
          this.applyFilters();
          this.loading = false;
          this.errorMsg = 'No se pudieron cargar los pases.';
          this.cdr.detectChanges();
        });
      },
    });
  }

  private normalizePass(raw: any): IBoardingPassEx {
    return {
      ...(raw as IBoardingPass),
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
    this.partialFiltered = this.partialActive.filter(match);

    const sortByValidTo = (a: any, b: any) => {
      const da = this.toJsDate(a.validTo)?.getTime() || 0;
      const db = this.toJsDate(b.validTo)?.getTime() || 0;
      return da - db; // 👈 ascendente (vence primero arriba)
    };

    this.activeFiltered.sort(sortByValidTo);
    this.partialFiltered.sort(sortByValidTo);

    this.cdr.detectChanges();
    this.currentPageActivos = 1;
    this.currentPageParciales = 1;
  }

  // helpers
  toJsDate(v: any): Date | null {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') return v.toDate(); // Firestore Timestamp
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
    // tu UI actual: completed => Pagado, else => Pago Parcial
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
    const total = this.tab === 'activos' ? this.activeFiltered.length : this.partialFiltered.length;
    if (total === 0) return 0;

    const page = this.tab === 'activos' ? this.currentPageActivos : this.currentPageParciales;
    return (page - 1) * this.pageSize + 1;
  }

  get toIndex(): number {
    const total = this.tab === 'activos' ? this.activeFiltered.length : this.partialFiltered.length;
    if (total === 0) return 0;

    const page = this.tab === 'activos' ? this.currentPageActivos : this.currentPageParciales;
    return Math.min(page * this.pageSize, total);
  }

  get totalItems(): number {
    return this.tab === 'activos' ? this.activeFiltered.length : this.partialFiltered.length;
  }

  prevPage() {
    if (this.tab === 'activos') {
      if (this.currentPageActivos > 1) this.currentPageActivos--;
    } else {
      if (this.currentPageParciales > 1) this.currentPageParciales--;
    }
  }

  nextPage() {
    if (this.tab === 'activos') {
      if (this.currentPageActivos < this.totalPagesActivos) this.currentPageActivos++;
    } else {
      if (this.currentPageParciales < this.totalPagesParciales) this.currentPageParciales++;
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
      console.log('Cargando parcialidades para', p);
      console.log(p.uid, p.idBoardingPass);
      
      
      // 1) pagos ya generados (subcolección)
      this.partialPayments = await firstValueFrom(
        this.productsService.getPartialPayments(p.customerId, p.product_id)
      );
      console.log( this.partialPayments.length, 'parcialidades ya generadas:', this.partialPayments);
      
      // 2) plan total (del pase)
      const plan = (p.partialPaymentsPlan || []) as any[];

      // 3) disponibles = plan - generados
      const generatedIds = new Set(this.partialPayments.map(x => x.id));
      this.availablePartialPayments = plan.filter(x => !generatedIds.has(x.id));
      console.log('Parcialidades disponibles:', this.availablePartialPayments);
      this.showAddPartialPaymentModal = true;
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
    this.openedRowMenu = null;

    console.log('Mensaje a usuario', p.user);
    // aquí abres modal de chat o navegas
  }

  openUserInfo(p: any) {
    this.openedRowMenu = null;

    console.log('Info usuario', p.user);
    // aquí abres modal de info
  }

  async confirmAddPartialPaymentModal() {
    const chosen = this.availablePartialPayments.find(x => x.id === this.selectedAvailablePaymentId);
    if (!chosen) {
      this.notification.warning('Selecciona un pago', 'And Informa');
      return;
    }

    const purchase = this.selectedPurchase as any;
    if (!purchase?.uid || !purchase?.idBoardingPass) {
      this.notification.error('Faltan datos de la compra (uid/idBoardingPass).', 'And Informa');
      return;
    }

    try {
      const addAmount = this.toNumber(chosen.amount);

      // ✅ Registro para subcolección (tu tabla lo espera así)
      const newPartialPayment = {
        id: chosen.id,
        active: true,
        amount: addAmount,
        startsAt: chosen.startsAt,
        endsAt: chosen.endsAt,
        paymentNumber: Number(chosen.paymentNumber),
        createdAt: Timestamp.fromDate(new Date()),
      };

      await this.productsService.addPartialPaymentDetail(
        purchase.uid,
        purchase.idBoardingPass,
        newPartialPayment
      );

      // ✅ Update boarding pass
      const newAmount = this.toNumber(purchase.amount) + addAmount;
      const newAmountPayment = this.toNumber(purchase.amountPayment) + addAmount;
      const newPartialPaymentAmount = this.toNumber(purchase.partialPaymentAmount) + addAmount;
      const newValidTo = chosen.endsAt.toDate().toISOString().slice(0, 10);

      await this.productsService.updateBoardingPass(purchase.uid, purchase.idBoardingPass, {
        amount: newAmount,
        amountPayment: newAmountPayment,
        partialPaymentAmount: newPartialPaymentAmount,
        validTo: newValidTo,
        endsAt: chosen.endsAt,
        partialPaymentId: chosen.id,
        partialPaymentAmountSelected: addAmount,
      });

      // ✅ Actualiza tabla del modal
      this.partialPayments = [...this.partialPayments, newPartialPayment];

      // ✅ Quita de disponibles
      this.availablePartialPayments = this.availablePartialPayments.filter(p => p.id !== chosen.id);
      this.selectedAvailablePaymentId = '';

      // ✅ Actualiza selectedPurchase (para que el reporte se refresque)
      this.selectedPurchase = {
        ...purchase,
        amount: newAmount,
        amountPayment: newAmountPayment,
        partialPaymentAmount: newPartialPaymentAmount,
        validTo: newValidTo,
        endsAt: chosen.endsAt,
        partialPaymentId: chosen.id,
        partialPaymentAmountSelected: addAmount,
      };

      // ✅ Refresca la fila en el reporte
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

}
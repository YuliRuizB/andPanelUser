import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, inject, NgZone, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
  Subscription,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { IBoardingPass } from '../../interfaces/dashboard.type';
import { CustomersService } from '../../services/customer.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { ProductsService } from '../../services/products.service';
import { Timestamp } from 'firebase/firestore';
import { PartialPayment, PartialPaymentOption } from '../../interfaces/product.type';



@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './users-component.html',
})
export class UsersComponent {
  authService = inject(AuthenticationService);
  productsService = inject(ProductsService)

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
  @ViewChild('chatBody') chatBody?: ElementRef<HTMLDivElement>;
  userChatMessageData: any[] = [];
  userActivityLogData: any[] = [];
  userActivityLogList: any[] = [];
  activityPageSize = 50;
  activityCurrentPage = 1;
  activityTotalItems = 0;
  activityTotalPages = 0;
  pagedActivityLog: any[] = [];
  loadingChatMessages = false;
  newMessage = '';
  readonly myUid = 'FyXKSXsUbYNtAbWL7zZ66o2f1M92';
  private userChatMessagesSubscription?: Subscription;
  private userActivityLogSubscription?: Subscription;
  activeSection: 'usuario' | 'pases' | 'mensajes' | 'card' | 'historial' | 'transferencias' = 'usuario';
  qrDataUrl: string = '';
  paymentNumber: number = 0;

  isBoardingPassModalOpen = false;
  isConfirmLoading = false;
  boardingPassForm!: FormGroup;

  products: any[] = [];
  routes2: any[] = [];
  stopPoints: any[] = [];


  ifValidPayment = false;
  isAnticipo = false;
  productSelected: any = null;
  receiptFile: File | null = null;
  partialPaymentOptions: PartialPaymentOption[] = [];
  fullpartialpaymentDocs: PartialPayment[] = [];
  partialPaymentDocs: PartialPayment[] = [];
  isPartialProduct = false;
  isPartialLoading = false;

  partialPayments: PartialPayment[] = [];
  isLoadingPartialPayments = false;
  showAddPartialPaymentModal = false;
  availablePartialPayments: PartialPayment[] = [];
  selectedAvailablePaymentId: string = '';

  nextEndsAt: any = null;

  constructor(
    private userService: userService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private customersService: CustomersService,
    private notification: ToastService,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
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
        this.users = [];
        this.filteredUsers = [];
        this.pagedUsers = [];
        this.currentPage = 1;
        this.totalItems = 0;
        this.totalPages = 0;
        this.selectedUser = null;

        this.cdr.detectChanges();
      });

    this.initBoardingPassForm();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.scrollToBottom(), 0);
  }

  ngOnDestroy() {
    this.userChatMessagesSubscription?.unsubscribe();
    this.userActivityLogSubscription?.unsubscribe();
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
      .getUsersList(cid)
      .pipe()
      .subscribe({
        next: (resp: any) => {
          this.ngZone.run(() => {
            const list =
              Array.isArray(resp) ? resp :
                Array.isArray(resp?.data) ? resp.data :
                  Array.isArray(resp?.users) ? resp.users :
                    resp ? [resp] : [];

            this.users = list as User1[];
            this.filteredUsers = this.users;
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
    this.cdr.detectChanges();
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
    this.cdr.detectChanges();
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
      this.cdr.detectChanges();
      this.notification.success('Usuario actualizado', 'And Informa');
    } catch (error) {
      this.notification.error('No se pudo actualizar el usuario', 'And Informa');
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  isBooleanField(key: UserInfoKey) {
    return key === 'emailVerified' || key === 'terms' || key === 'roundTrip';
  }

  setSection(section: 'usuario' | 'pases' | 'mensajes' | 'historial' | 'card' | 'transferencias') {
    this.ngZone.run(() => {
      this.activeSection = section;

      if (section === 'pases' && this.selectedUser?.uid) {
        this.getLatestPurchases(this.selectedUser.uid);
      }

      if (section === 'mensajes' && this.selectedUser?.uid) {
        this.getUserChatMessages(this.selectedUser.uid);
      }

      if (section === 'historial' && this.selectedUser?.uid) {
        this.getUserActivityLog(this.selectedUser.uid);
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
      if (reqId !== this.latestPurchasesReqId) return;

      this.ngZone.run(() => {
        this.latestPurchases = [];
        this.loadingLatestPurchases = false;
        this.notification.error('Error cargando pases', 'And Informa');
        console.error(err);
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
  }
  deletePurchase(p: IBoardingPass, ev?: MouseEvent) {
    ev?.stopPropagation();
    this.purchaseActionMenuOpenId = null;

    if (!this.selectedUser) return;

    const id = (p.id ?? p.idBoardingPass) as string;

    this.userService.deleteBoardingPass(this.selectedUser.uid, id)
      .then(() => {
        this.ngZone.run(() => {
          this.notification.success('¡Boarding pass eliminado!', 'And Informa');

          this.latestPurchases = this.latestPurchases.filter(x =>
            (x.id ?? x.idBoardingPass) !== id
          );

          if ((this.selectedPurchase?.id ?? this.selectedPurchase?.idBoardingPass) === id) {
            this.selectedPurchase = null;
          }

          this.cdr.detectChanges();
        });
      })
      .catch(err => this.ngZone.run(() => this.notification.error(err, 'And Informa')));
  }


  activatePurchase(p: IBoardingPass, active: boolean, ev?: MouseEvent) {
    ev?.stopPropagation();
    this.purchaseActionMenuOpenId = null;

    if (!this.selectedUser) return;

    const id = (p.id ?? p.idBoardingPass) as string;

    this.userService.activatePurchase(this.selectedUser.uid, id, active)
      .then(() => {
        this.ngZone.run(() => {
          this.notification.success(active ? '¡Boleto activado!' : '¡Boleto suspendido!', 'And Informa');

          this.latestPurchases = this.latestPurchases.map(x => {
            const xid = x.id ?? x.idBoardingPass;
            return xid === id ? { ...x, active } : x;
          });

          if (this.selectedPurchase && ((this.selectedPurchase.id ?? this.selectedPurchase.idBoardingPass) === id)) {
            this.selectedPurchase.active = active;
          }

          this.cdr.detectChanges();
        });
      })
      .catch(err => this.ngZone.run(() => this.notification.error(err, 'And Informa')));
  }



  selectPurchase(purchase: any) {
    this.selectedPurchase = purchase;
    this.purchaseDetailTab = 'detalle';

    const uid = purchase.uidUser || purchase.uid || purchase.user?.uid || purchase.idBoardingPass /* no */;
    const boardingPassId = purchase.idBoardingPass || purchase.boardingPassId || purchase.id;

    if (purchase.isParcialPayment && uid && boardingPassId) {
      this.loadPartialPayments(uid, boardingPassId);
    }

    this.cdr.detectChanges();
  }

  private async loadPartialPayments(uid: string, boardingPassId: string) {
    try {
      this.isLoadingPartialPayments = true;
      const list = await this.productsService.getPartialPaymentDetails(uid, boardingPassId);

      this.partialPayments = (list || []).sort(
        (a, b) => Number(a.paymentNumber ?? 0) - Number(b.paymentNumber ?? 0)
      );
    } catch (e) {
      this.partialPayments = [];
    } finally {
      this.isLoadingPartialPayments = false;
      this.cdr.detectChanges();
    }
  }

  trackByMsgId = (_: number, item: any) => item?.id ?? _;

  isMe(m: any): boolean {
    return m?.from === this.myUid;
  }

  canSend(): boolean {
    return !!this.selectedUser?.uid && (this.newMessage?.trim()?.length ?? 0) > 0;
  }

  onComposerKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      if (this.canSend()) this.showModalMessageCenter();
    }
  }
  reloadMessages() {
    if (this.selectedUser?.uid) {
      this.getUserChatMessages(this.selectedUser.uid);
    }
  }

  getUserChatMessages(userId: string): void {
    this.loadingChatMessages = true;

    if (this.userChatMessagesSubscription) {
      this.userChatMessagesSubscription.unsubscribe();
    }

    this.userChatMessagesSubscription = this.userService
      .getUserChatMessages(userId, 10)
      .subscribe((userChatMsn: any) => {
        this.userChatMessageData = userChatMsn;

        this.userChatMessageData = [...this.userChatMessageData].sort((a, b) => {
          const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return da.getTime() - db.getTime();
        });
        this.cdr.detectChanges();
        this.loadingChatMessages = false;
        setTimeout(() => this.scrollToBottom(), 0);
      });
  }

  getUserActivityLog(userId: string): void {
    this.userActivityLogSubscription?.unsubscribe();

    this.userActivityLogSubscription = this.userService
      .getActivityLog(userId)
      .subscribe((userActivityLog: any) => {
        this.ngZone.run(() => {
          this.userActivityLogData = userActivityLog;
          this.userActivityLogList = Array.isArray(userActivityLog?.data) ? userActivityLog.data : [];

          this.activityCurrentPage = 1;
          this.computeActivityPagination();
          this.cdr.detectChanges();
        });
      });
  }

  private scrollToBottom() {
    const el = this.chatBody?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  async showModalMessageCenter() {
    if (this.selectedUser?.uid) {
      const dataMessage = {
        createdAt: new Date(),
        from: this.myUid,
        fromName: 'Apps And Informa',
        msg: this.newMessage.trim(),
        requestId: 'suhB7YFAh6PYXCRuJhfD',
        token: this.selectedUser.token,
        uid: this.selectedUser.uid,
        result: ""
      };

      const notifMessage = {
        timestamp: new Date(),
        title: 'Apps And Informa General',
        from: this.myUid,
        requestId: 'suhB7YFAh6PYXCRuJhfD',
        body: this.newMessage.trim(),
        token: this.selectedUser.token,
        uid: this.selectedUser.uid
      };

      this.userService.setMessage(notifMessage, this.selectedUser.uid);

      await this.userService.setChatMessage(dataMessage);
      this.newMessage = "";
      setTimeout(() => this.scrollToBottom(), 0);
    } else {
      this.notification.error('Selecciona un usuario para enviar mensajes', 'And Informa');
    }
  }

  computeActivityPagination() {
    this.activityTotalItems = this.userActivityLogList.length;
    this.activityTotalPages = Math.ceil(this.activityTotalItems / this.activityPageSize);

    const start = (this.activityCurrentPage - 1) * this.activityPageSize;
    const end = start + this.activityPageSize;

    this.pagedActivityLog = this.userActivityLogList.slice(start, end);
  }

  nextActivityPage() {
    if (this.activityCurrentPage < this.activityTotalPages) {
      this.activityCurrentPage++;
      this.computeActivityPagination();
    }
  }

  prevActivityPage() {
    if (this.activityCurrentPage > 1) {
      this.activityCurrentPage--;
      this.computeActivityPagination();
    }
  }

  get activityFromIndex(): number {
    if (this.activityTotalItems === 0) return 0;
    return (this.activityCurrentPage - 1) * this.activityPageSize + 1;
  }

  get activityToIndex(): number {
    return Math.min(this.activityCurrentPage * this.activityPageSize, this.activityTotalItems);
  }

  async downloadPdf() {
    try {

      await this.buildQr();
      await new Promise(requestAnimationFrame);
      const element = document.getElementById('credencial') as HTMLElement | null;
      if (!element) return;

      const { wrapper, clone } = this.makeHtml2CanvasSafeClone(element);
      await this.waitForImages(clone);


      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      });


      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'pt', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;

      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
      pdf.save('credencial.pdf');

      wrapper.remove();
    } catch (e) {
      this.notification.error('Error al actualizar', 'And Informa');
    }
  }

  onAvatarError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.src = 'assets/images/logo2.jpeg';
  }

  get qrValue(): string {
    const uid = this.selectedUser?.uid ?? '';
    const passId =
      this.selectedPurchase?.idBoardingPass ??
      this.latestPurchases?.[0]?.idBoardingPass ??
      this.selectedPurchase?.id ??
      this.latestPurchases?.[0]?.id ??
      '';
    return `${uid}-${passId}`;
  }

  private makeHtml2CanvasSafeClone(el: HTMLElement): { wrapper: HTMLElement; clone: HTMLElement } {
    const clone = el.cloneNode(true) as HTMLElement;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-10000px';
    wrapper.style.top = '0';
    wrapper.style.background = '#ffffff';
    wrapper.style.zIndex = '999999';
    wrapper.style.padding = '0';
    wrapper.appendChild(clone);

    const nodes = wrapper.querySelectorAll<HTMLElement>('*');

    nodes.forEach((node) => {
      const cls = (node.getAttribute('class') || '')
        .split(/\s+/)
        .filter(Boolean)
        .filter((c) => {
          return !(
            c.startsWith('bg-') ||
            c.startsWith('text-') ||
            c.startsWith('border-') ||
            c.startsWith('shadow') ||
            c.startsWith('ring') ||
            c.startsWith('outline') ||
            c.startsWith('from-') ||
            c.startsWith('to-') ||
            c.startsWith('via-')
          );
        });

      if (cls.length) node.setAttribute('class', cls.join(' '));
      else node.removeAttribute('class');

      node.style.color = node.style.color || '#0f172a';
      node.style.outlineColor = '#0f172a';

    });

    clone.style.flexWrap = 'nowrap';
    clone.style.backgroundColor = '#f1f5f9';

    document.body.appendChild(wrapper);
    return { wrapper, clone };
  }

  async buildQr(): Promise<void> {
    try {
      this.qrDataUrl = await QRCode.toDataURL(this.qrValue, {
        width: 220,
        margin: 1,
      });
    } catch (e) {
      console.error('QR error', e);
      this.qrDataUrl = '';
    }
  }

  private async waitForImages(container: HTMLElement) {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
        });
      })
    );
  }

  private initBoardingPassForm() {
    const today = this.toDateInputValue(new Date());

    this.boardingPassForm = this.fb.group({
      active: [true, Validators.required],
      product_id: ['', Validators.required],
      routeId: ['', Validators.required],
      routeName: ['', Validators.required],
      stopId: ['', Validators.required],
      stopName: ['', Validators.required],
      stopDescription: ['', Validators.required],
      round: ['', Validators.required],
      payment: ['', Validators.required],
      typePayment: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      amountPayment: [0, [Validators.required, Validators.min(0)]],
      is_courtesy: [false],
      promiseDate: [today],
      validFrom: [today, Validators.required],
      validTo: ['', Validators.required],
      fileURL: [''],
      isParcialPayment: [false],
      partialPaymentAmount: [0],
      partialPaymentsCount: [0],
      partialPaymentId: [''],
      partialPaymentAmountSelected: [0],
      name: ['', Validators.required],
      description: ['', Validators.required],
      product_description: ['', Validators.required],
      price: [0, Validators.required],
      category: ['', Validators.required],
      currency: ['MXN', Validators.required],
      status: ['completed', Validators.required],
      creation_date: [new Date().toISOString(), Validators.required],
      operation_date: [new Date().toISOString(), Validators.required],
    });
  }

  addBoardingPPass(uid: string) {

    this.isBoardingPassModalOpen = true;

    this.initBoardingPassForm();
    this.receiptFile = null;
    this.ifValidPayment = false;
    this.isAnticipo = false;
    this.productSelected = null;
    this.loadProductsAndRoutes();
  }

  closeBoardingPassModal() {
    this.isBoardingPassModalOpen = false;

    setTimeout(() => {
      this.boardingPassForm.reset();
      this.productSelected = null;
      this.partialPaymentOptions = [];
    }, 0);
  }

  isInvalid(controlName: string): boolean {
    const c = this.boardingPassForm.get(controlName);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  private toDateInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  async loadProductsAndRoutes() {
    if (this.selectedUser?.customerId) {
      this.products = await this.productsService.getProducts(this.selectedUser?.customerId);
      this.routes2 = await this.productsService.getRoutes(this.selectedUser?.customerId);
    }
  }

  onProductSelected(productId: string) {
    const record = this.products.find(p => p.productId === productId);
    if (!record) return;

    this.productSelected = record;



    this.boardingPassForm.patchValue({
      product_id: record.productId,
      name: record.name,
      description: record.description,
      product_description: record.description,
      amount: record.price,
      amountPayment: record.price,
      price: record.price,
      category: record.category,
      paymentNumber: record.paymentNumber || 0,
      isParcialPayment: record.isParcialPayment || false,
      partialPaymentAmount: record.partialPaymentAmount || 0,
      partialPaymentsCount: record.partialPaymentsCount || 0
    });

    this.boardingPassForm.patchValue({ is_courtesy: false, status: 'completed' });

    this.boardingPassForm.patchValue({
      partialPaymentId: '',
      partialPaymentAmountSelected: 0,
    }, { emitEvent: false });


    if (record.isParcialPayment === true) {
      this.isPartialProduct = true;
      this.loadPartialPaymentOptions(record.customerId, record.productId);
    } else {
      this.partialPaymentOptions = [];
      this.partialPaymentDocs = [];
      this.isPartialProduct = false;
      this.boardingPassForm.patchValue({
        partialPaymentId: '',
        partialPaymentAmountSelected: 0
      }, { emitEvent: false });
    }

  }

  async onRouteSelected(routeId: string) {
    const r = this.routes2.find(x => x.routeId === routeId);

    if (!r) {
      this.boardingPassForm.patchValue({ routeName: '' });
      this.stopPoints = [];
      return;
    }

    this.boardingPassForm.patchValue({
      routeId: r.routeId,
      routeName: r.name
    });

    await this.loadStopsByRoute(routeId);
  }

  async loadStopsByRoute(routeId: string) {

    if (!routeId) {
      this.stopPoints = [];
      this.notification.info('Selecciona una operación.', 'And Informa');
      return;
    }
    if (!this.selectedUser?.customerId) {
      this.stopPoints = [];
      return;
    }

    this.stopPoints = await this.productsService.getStopPoints(
      this.selectedUser.customerId,
      routeId
    );

  }

  onStopSelected(stopId: string) {
    const s = this.stopPoints.find(x => x.stopPointId === stopId);
    if (!s) return;

    this.boardingPassForm.patchValue({
      stopId: s.stopPointId,
      stopName: s.name,
      stopDescription: s.description
    });
  }

  changePayment(payment: string) {
    this.isAnticipo = payment === 'Anticipo';
    const isParcialPayment = this.boardingPassForm.value.isParcialPayment;
    if (isParcialPayment) {
      return;
    }
    if (payment === 'Mensualidad') {
      const amount = Number(this.boardingPassForm.get('amount')?.value || 0);
      this.boardingPassForm.patchValue({ amountPayment: amount });
    }

    if (payment === 'Anticipo' || payment === 'Liquidacion') {
      this.boardingPassForm.patchValue({ amountPayment: 0 });
    }
  }

  changePaymentType(typePayment: string) {
    this.ifValidPayment = typePayment === 'Transferencia';

    if (!this.ifValidPayment) {
      this.receiptFile = null;
      this.boardingPassForm.patchValue({ fileURL: '' });
    }
  }

  onCourtesyChange() {
    const isCourtesy = !!this.boardingPassForm.get('is_courtesy')?.value;
    if (isCourtesy) {
      this.boardingPassForm.patchValue({ amount: 0, amountPayment: 0 });
    }
  }

  onAmountChange() {
    const amount = Number(this.boardingPassForm.get('amount')?.value || 0);
    const isCourtesy = !!this.boardingPassForm.get('is_courtesy')?.value;

  }

  onReceiptSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.receiptFile = file;

  }

  async submitBoardingPass() {
    this.boardingPassForm.markAllAsTouched();

    if (this.boardingPassForm.invalid) return;
    const payment = this.boardingPassForm.value.payment;
    const typePayment = this.boardingPassForm.value.typePayment;

    if (payment === 'Anticipo' && !this.boardingPassForm.value.promiseDate) {
      return;
    }

    const amount = Number(this.boardingPassForm.value.amount || 0);
    const amountPayment = Number(this.boardingPassForm.value.amountPayment || 0);

    if (amountPayment <= 0) {
      this.notification.warning('La cantidad a pagar debe ser mayor a 0.', 'And Informa');
      return;
    }

    if (amountPayment > amount) {
      this.notification.warning('La cantidad a pagar no puede ser mayor que el monto total.', 'And Informa');
      return;
    }

    const isPartialProduct = this.productSelected?.isParcialPayment === true
      || this.boardingPassForm.value.isParcialPayment === true;

    if (!isPartialProduct && payment === 'Mensualidad' && amountPayment !== amount) {
      this.notification.warning('La cantidad a pagar debe ser igual al monto total para mensualidades.', 'And Informa');
      return;
    }

    if (typePayment === 'Transferencia' && !this.receiptFile && !this.boardingPassForm.value.fileURL) {
      this.notification.warning('Debes adjuntar comprobante para transferencia.', 'And Informa');
      return;
    }
    const nowIso = new Date().toISOString();

    const validToVal = this.boardingPassForm.value.validTo;
    const validToIso = validToVal instanceof Date ? validToVal.toISOString() : (validToVal || nowIso);

    const validFromVal = this.boardingPassForm.value.validFrom;
    const validFromIso = validFromVal instanceof Date ? validFromVal.toISOString() : (validFromVal || nowIso);

    const isCourtesy = !!this.boardingPassForm.value.is_courtesy;

    if (isPartialProduct && !this.boardingPassForm.value.partialPaymentId) {
      this.notification.warning('Selecciona el periodo del pago parcial.', 'And Informa');
      return;
    }

    let status: 'partial' | 'completed' = 'completed';

    if (isCourtesy) {
      status = 'completed';
    } else if (isPartialProduct) {
      status = 'partial';
    } else {
      status = (amountPayment !== amount) ? 'partial' : 'completed';
    }

    this.boardingPassForm.patchValue({ status }, { emitEvent: false });

    const send = {
      ...this.boardingPassForm.value,
      authorization: "portalAuth",
      user: this.selectedUser,
      customerId: this.selectedUser?.customerId,
      customer: {
        name: this.selectedUser?.firstName || "",
        last_name: this.selectedUser?.lastName || "",
        email: this.selectedUser?.email || "",
        phone_number: this.selectedUser?.phoneNumber || "",
        address: "",
        creation_date: "",
        external_id: "",
        clabe: ""
      },
      card: {
        type: '',
        brand: '',
        address: '',
        card_number: '',
        holder_name: '',
        expiration_year: '',
        expiration_month: '',
        allows_charges: '',
        allows_payouts: '',
        bank_name: '',
        bank_code: '',
        points_card: '',
        points_type: '',
      },

      paidApp: 'portal',
      isOpenpay: false,
      conciliated: false,
      transaction_type: 'charge',
      operation_type: 'in',
      method: payment,
      currency: "MXN",
      creation_date: nowIso,
      date_created: nowIso,
      operation_date: nowIso,
      description: "Pago a traves de portal",
      error_message: "",
      order_id: "portalOrder",
      amount: Number(this.boardingPassForm.value.amountPayment || 0),
      active: true,
      category: "permanente",
      product_description: "Pago a traves de portal",
      isTaskIn: "false",
      isTaskOut: "false",
      type: "Servicio",
      stopDescription: "",
      product: {
        product_id: this.boardingPassForm.value.product_id,
        amountTrips: Number(this.boardingPassForm.value.amountTrips || 0),
        frequencies: Number(this.boardingPassForm.value.frequencies || 0),
        rangeWeeks: this.boardingPassForm.value.rangeWeeks || {},
        weeks: Number(this.boardingPassForm.value.weeks || 0),
        name: this.boardingPassForm.value.productName || this.boardingPassForm.value.name || ""
      },
      validFrom: validFromIso,
      validTo: validToIso,
    };

    try {
      this.isConfirmLoading = true;
      const uid = this.selectedUser?.uid;
      if (!uid) {
        this.notification.error('No hay usuario seleccionado.', 'And Informa');
        return;
      }


      const boardingPassId = await this.productsService.addBoardingPass(uid, send);
      if (!boardingPassId) throw new Error('No se pudo crear el boarding pass');
      send.idBoardingPass = boardingPassId;

      if (isPartialProduct) {

        const partialPaymentId = this.boardingPassForm.value.partialPaymentId;

        const startsAt = validFromVal instanceof Date
          ? Timestamp.fromDate(validFromVal)
          : Timestamp.fromDate(new Date(validFromIso));

        const endsAt = validToVal instanceof Date
          ? Timestamp.fromDate(validToVal)
          : Timestamp.fromDate(new Date(validToIso));

        await this.productsService.addPartialPaymentDetail(uid, boardingPassId, {
          id: partialPaymentId,
          active: true,
          amount: Number(this.boardingPassForm.value.amountPayment || 0),
          startsAt,
          paymentNumber: this.paymentNumber,
          endsAt,
        });
      }

      await this.productsService.addBoardingPassDetail(uid, boardingPassId, send);

      await this.productsService.createPurchaseCloud(send, this.selectedUser, boardingPassId);

      this.notification.success('Pase generado correctamente.', 'And Informa');

      setTimeout(() => {
        this.closeBoardingPassModal();
      }, 0);

    } catch (e) {
      console.error(e);
      this.notification.error('Ocurrió un error al generar el pase.', 'And Informa');
    } finally {
      this.isConfirmLoading = false;
    }
  }

  openBoardingPassModal(uid: string) {
    if (!uid) return;

    this.isBoardingPassModalOpen = true;
    this.initBoardingPassForm();
    this.receiptFile = null;
    this.ifValidPayment = false;
    this.isAnticipo = false;
    this.productSelected = null;
    this.loadProductsAndRoutes();
  }

  getCreationDate(purchase: any): Date | null {
    const v = purchase?.creation_date;
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v?.toDate === 'function') return v.toDate();
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  private formatEsDate(date?: Date): string {
    if (!date) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  loadPartialPaymentOptions(customerId: string, productId: string): void {
    if (!customerId || !productId) {
      this.partialPaymentOptions = [];
      this.partialPaymentDocs = [];
      this.isPartialProduct = false;
      this.boardingPassForm.patchValue({
        partialPaymentId: '',
        partialPaymentAmountSelected: 0
      });
      return;
    }

    this.isPartialLoading = true;
    this.isPartialProduct = true;

    this.userService.getPartialPayments(customerId, productId, true).subscribe({
      next: (docs) => {
        this.partialPaymentDocs = docs;

        this.partialPaymentOptions = docs.map((pp) => {
          const startsAt = pp.startsAt?.toDate?.() ?? new Date();
          const endsAt = pp.endsAt?.toDate?.() ?? new Date();
          const amount = Number(pp.amount ?? 0);

          return {
            id: pp.id,
            amount,
            startsAt,
            endsAt,
            paymentNumber: pp.paymentNumber,
            label: `${this.formatEsDate(startsAt)} - ${this.formatEsDate(endsAt)} // $${amount}`,
          };
        });

        this.isPartialProduct = this.partialPaymentOptions.length > 0;
        this.boardingPassForm.get('partialPaymentsCount')
          ?.setValue(docs.length, { emitEvent: false });

        this.boardingPassForm.patchValue({
          partialPaymentId: '',
          partialPaymentAmountSelected: 0
        }, { emitEvent: false });

        this.isPartialLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading partial payments', err);
        this.partialPaymentOptions = [];
        this.partialPaymentDocs = [];
        this.isPartialProduct = true;
        this.boardingPassForm.patchValue({
          partialPaymentId: '',
          partialPaymentAmountSelected: 0
        }, { emitEvent: false });
        this.isPartialLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadPartialPayment(customerId: string, productId: string): void {
    if (!customerId || !productId) {
      this.fullpartialpaymentDocs = [];
      this.availablePartialPayments = [];
      return;
    }

    this.userService.getPartialPayments(customerId, productId, true).subscribe({
      next: (docs) => {
        this.fullpartialpaymentDocs = docs || [];
        this.buildAvailablePartialPayments();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading partial payments', err);
        this.fullpartialpaymentDocs = [];
        this.availablePartialPayments = [];
        this.cdr.detectChanges();
      },
    });
  }

  onPartialPaymentSelected(partialPaymentId: string): void {
    const opt = this.partialPaymentOptions.find(o => o.id === partialPaymentId);
    if (!opt) return;

    this.paymentNumber = opt.paymentNumber || 0;

    this.boardingPassForm.patchValue({
      partialPaymentId: opt.id,
      partialPaymentAmountSelected: opt.amount,
      amountPayment: opt.amount,
      paymentNumber: opt.paymentNumber,
      validFrom: this.toDateInputValue(opt.startsAt),
      validTo: this.toDateInputValue(opt.endsAt),
    }, { emitEvent: false });

    this.cdr.detectChanges();
  }

  get canAddPartialPayment(): boolean {
    const count = this.partialPayments?.length ?? 0;
    const limit = Number(this.selectedPurchase?.partialPaymentsCount ?? 0);
    return !!this.selectedPurchase?.isParcialPayment && limit > 0 && count < limit;
  }

  async openAddPartialPaymentModal() {
    if (!this.canAddPartialPayment) return;
    if (!this.selectedPurchase) return;

    const uid = this.selectedPurchase.uid || this.selectedUser?.uid;
    const boardingPassId = this.selectedPurchase.idBoardingPass || this.selectedPurchase.id;

    if (this.selectedPurchase.isParcialPayment && uid && boardingPassId && !this.partialPayments.length) {
      await this.loadPartialPayments(uid, boardingPassId);
    }

    this.loadPartialPayment(this.user.customerId, this.selectedPurchase.product_id);
    this.selectedAvailablePaymentId = '';
    this.showAddPartialPaymentModal = true;
  }


  cancelAddPartialPaymentModal() {
    this.showAddPartialPaymentModal = false;
  }

  private getUsedPaymentNumbers(): Set<number> {
    return new Set(
      (this.partialPayments || [])
        .map(p => Number(p?.paymentNumber))
        .filter(n => Number.isFinite(n))
    );
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


    const purchase = this.selectedPurchase;
    if (!purchase?.uid || !purchase?.idBoardingPass || !purchase?.id) {
      this.notification.error('Faltan datos de la compra (uid/idBoardingPass/id).', 'And Informa');
      return;
    }

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
        validTo: newValidTo,
        endsAt: nextEndsAt,
        partialPaymentId: chosen.id,
        partialPaymentAmountSelected: addAmount,
      };

      this.showAddPartialPaymentModal = false;
      this.cdr.markForCheck();

      this.notification.success('Pago parcial agregado y compra actualizada.', 'And Informa');
    } catch (e) {
      console.error('Error confirmAddPartialPaymentModal:', e);
      this.notification.error('No se pudo agregar el pago parcial.', 'And Informa');
    }
  }


  private buildAvailablePartialPayments() {
    const used = this.getUsedPaymentNumbers();

    this.availablePartialPayments = (this.fullpartialpaymentDocs || [])
      .filter(pp => {
        const n = Number(pp?.paymentNumber);
        if (!Number.isFinite(n)) return false;
        return !used.has(n);
      })
      .sort((a, b) => Number(a.paymentNumber) - Number(b.paymentNumber));
  }

  private tsToYmd(ts: any): string {
    const d = ts.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  async deletePartialPaymentModal(p: any) {
    const purchase = this.selectedPurchase;
    if (!purchase?.uid || !purchase?.idBoardingPass) {
      this.notification.error('Faltan datos de la compra (uid/idBoardingPass).', 'And Informa');
      return;
    }

    const ok = confirm(`¿Seguro que desea borrar el pago #${p.paymentNumber}? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {

      await this.productsService.deletePartialPaymentDetail(
        purchase.uid,
        purchase.idBoardingPass,
        p.id
      );

      const removeAmount = this.toNumber(p.amount);

      const remaining = this.partialPayments.filter(x => x.id !== p.id);
      this.partialPayments = remaining;

      this.availablePartialPayments = [...this.availablePartialPayments, p]
        .sort((a, b) => (a.paymentNumber ?? 0) - (b.paymentNumber ?? 0));

      const newAmount = this.toNumber(purchase.amount) - removeAmount;
      const newAmountPayment = this.toNumber(purchase.amountPayment) - removeAmount;
      const newPartialPaymentAmount = this.toNumber(purchase.partialPaymentAmount) - removeAmount;

      const activeRemaining = remaining.filter(x => x.active);

      let newEndsAt: Timestamp | null = null;
      let newValidTo: string | null = null;

      if (activeRemaining.length) {
        const maxEndsAt = activeRemaining
          .map(x => x.endsAt)
          .sort((a, b) => a.toMillis() - b.toMillis())
          .at(-1)!;

        newEndsAt = maxEndsAt;
        newValidTo = maxEndsAt.toDate().toISOString().slice(0, 10);
      } else {
        newEndsAt = null;
        newValidTo = null;

      }

      let partialPaymentId: string | null = purchase.partialPaymentId ?? null;
      let partialPaymentAmountSelected: number | null = purchase.partialPaymentAmountSelected ?? null;

      if (purchase.partialPaymentId === p.id) {
        if (activeRemaining.length) {
          const selected = activeRemaining
            .slice()
            .sort((a, b) => a.endsAt.toMillis() - b.endsAt.toMillis())
            .at(-1)!;

          partialPaymentId = selected.id;
          partialPaymentAmountSelected = this.toNumber(selected.amount);
        } else {
          partialPaymentId = null;
          partialPaymentAmountSelected = null;
        }
      }


      await this.productsService.updateBoardingPass(purchase.uid, purchase.idBoardingPass, {
        amount: newAmount,
        amountPayment: newAmountPayment,
        partialPaymentAmount: newPartialPaymentAmount,
        validTo: newValidTo ?? '',
        endsAt: newEndsAt ?? null,
        partialPaymentId: partialPaymentId ?? null,
        partialPaymentAmountSelected: partialPaymentAmountSelected ?? null,
      });


      this.selectedPurchase = {
        ...purchase,
        amount: newAmount,
        amountPayment: newAmountPayment,
        partialPaymentAmount: newPartialPaymentAmount,
        validTo: newValidTo ?? '',
        endsAt: newEndsAt ?? purchase.endsAt,
        partialPaymentId: partialPaymentId ?? undefined,
        partialPaymentAmountSelected: partialPaymentAmountSelected ?? undefined,
      };

      this.cdr.markForCheck();
      this.notification.success('Pago parcial eliminado y compra revertida.', 'And Informa');
    } catch (e) {
      console.error('Error deletePartialPaymentModal:', e);
      this.notification.error('No se pudo borrar el pago parcial.', 'And Informa');
    }
  }

  computeNextEndsAt(): void {
    const chosen = this.availablePartialPayments.find(p => p.id === this.selectedAvailablePaymentId);

    if (!chosen) {
      this.nextEndsAt = null;
      return;
    }

    const ordered = [...this.availablePartialPayments].sort(
      (a, b) => Number(a.paymentNumber) - Number(b.paymentNumber)
    );
    const idx = ordered.findIndex(p => p.id === chosen.id);

    this.nextEndsAt =
      (idx !== -1 && idx < ordered.length - 1)
        ? ordered[idx + 1].endsAt
        : chosen.endsAt;
  }


}
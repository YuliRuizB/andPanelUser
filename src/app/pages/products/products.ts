import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray, AbstractControl } from '@angular/forms';
import { AuthenticationService } from '../../services/authentication.service';
import { Product } from '../../interfaces/product.type';
import { catchError, distinctUntilChanged, filter, map, of, Subject, switchMap, takeUntil, tap, firstValueFrom } from 'rxjs';
import { User1 } from '../../interfaces/user.type';
import { Timestamp } from 'firebase/firestore';
import { ProductsService } from '../../services/products.service';
import { ToastService } from '../../services/toast.service';

type TabKey = 'active' | 'inactive' | 'add';

@Component({
  selector: 'app-products',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class ProductsComponent {
  authService = inject(AuthenticationService);

  tab: TabKey = 'active';
  addForm!: FormGroup;
  editForm!: FormGroup;

  customerId!: string;
  products: Product[] = [];

  isModalOpen = false;
  selected?: Product;

  saving = false;
  user: any = null;

  selectedFileName = '';
  imagePreviewUrl: string | null = null;
  selectedFile: File | null = null;

  private destroy$ = new Subject<void>();

  partialPreview: { i: number; startsAt: string; endsAt: string; amount: number }[] = [];

  constructor(
    private productsSvc: ProductsService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private notification: ToastService
  ) {
    this.initForms();
  }

  private initForms() {
    this.addForm = this.fb.group({
      imageFile: [null, Validators.required],
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      category: ['permanente'],
      type: ['Servicio'],
      price: [0, [Validators.required, Validators.min(0)]],
      active: [true, Validators.required],
      validFrom: ['', Validators.required],
      validTo: ['', Validators.required],
      validFromPartial: [''],
      validToPartial: [''],
      transportType: [''],
      amountTrips: [0],
      isTaskIn: [true],
      isTaskOut: [true],
      isCalculate: [false],
      disable: [false],

      isParcialPayment: [false],
      partialPaymentsCount: [2, [Validators.min(2), Validators.max(24)]],
      partialPaymentAmount: [{ value: 0, disabled: true }],
      partialPayments: this.fb.array([]),
    });

    this.editForm = this.fb.group({
      imageFile: [null],
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(1)]],
      category: [''],
      type: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      active: [true, Validators.required],
      validFrom: ['', Validators.required],
      validTo: ['', Validators.required],
      validFromPartial: [''],
      validToPartial: [''],
      transportType: [''],
      amountTrips: [0],
      isTaskIn: [true],
      isTaskOut: [true],
      isCalculate: [false],
      disable: [false],

      isParcialPayment: [false],
      partialPaymentsCount: [2, [Validators.min(2), Validators.max(60)]],
      partialPaymentAmount: [{ value: 0, disabled: true }],
      partialPayments: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    // EDIT: toggle parcial
    this.editForm.get('isParcialPayment')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((on: boolean) => {
        if (!on) this.editPartialPaymentsFA.clear();
        else {
          const n = Math.max(2, Number(this.editForm.get('partialPaymentsCount')?.value ?? 2));
          if (this.editPartialPaymentsFA.length === 0) this.rebuildEditPartialPayments(n);
        }
        this.recomputeEditBaseAmount();
      });

    // EDIT: cambia count
    this.editForm.get('partialPaymentsCount')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((n) => {
        if (!this.editForm.get('isParcialPayment')?.value) return;
        const N = Math.max(2, Number(n ?? 2));
        this.rebuildEditPartialPayments(N);
      });

    // EDIT: cambia precio
    this.editForm.get('price')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.recomputeEditBaseAmount());

    this.editForm.get('validFromPartial')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.editForm.get('isParcialPayment')?.value) return;
        this.rebuildEditPartialPayments(Number(this.editForm.get('partialPaymentsCount')?.value ?? 2));
      });

    this.editForm.get('validToPartial')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.editForm.get('isParcialPayment')?.value) return;
        this.rebuildEditPartialPayments(Number(this.editForm.get('partialPaymentsCount')?.value ?? 2));
      });


    // ADD: si cambian fechas base, reconstruye (opcional)
    this.addForm.get('validFromPartial')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.addForm.get('isParcialPayment')?.value) return;
        this.rebuildPartialPayments(Number(this.addForm.get('partialPaymentsCount')?.value ?? 2));
      });

    this.addForm.get('validToPartial')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (!this.addForm.get('isParcialPayment')?.value) return;
        this.rebuildPartialPayments(Number(this.addForm.get('partialPaymentsCount')?.value ?? 2));
      });

    this.addForm.get('partialPaymentsCount')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((n) => {
        if (!this.addForm.get('isParcialPayment')?.value) return;
        const N = Math.max(2, Number(n ?? 2));
        this.rebuildPartialPayments(N);
      });

    this.addForm.get('isParcialPayment')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((on: boolean) => {
        if (!on) {
          this.partialPaymentsFA.clear();
          return;
        }
        const n = Math.max(2, Number(this.addForm.get('partialPaymentsCount')?.value ?? 2));
        this.rebuildPartialPayments(n);
      });

    // carga productos
    this.authService.user$
      .pipe(
        filter((u): u is User1 => !!u?.customerId),
        distinctUntilChanged((a, b) => a.customerId === b.customerId),
        tap((u) => (this.user = u)),
        map((u) => u.customerId!),
        switchMap((cid) => {
          this.customerId = cid;
          return this.productsSvc.products$(cid).pipe(
            catchError((err) => {
              console.error('products$ error', err);
              return of([] as Product[]);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((list) => {
        this.zone.run(() => {
          this.products = list ?? [];
          this.cdr.markForCheck();
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get activeProducts() {
    return (this.products ?? []).filter((p) => !!p.active);
  }

  get inactiveProducts() {
    return (this.products ?? []).filter((p) => !p.active);
  }

  setTab(t: TabKey) {
    this.tab = t;
    this.closeModal();

    if (t !== 'add') {
      if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
      this.imagePreviewUrl = null;
      this.selectedFileName = '';
      this.selectedFile = null;
      this.addForm.patchValue({ imageFile: null });
      this.addForm.get('imageFile')?.updateValueAndValidity();
    }
  }

  async openModal(p: Product) {
    this.selected = p;
    this.isModalOpen = true;

    const vf = (p as any).validFrom ?? (p as any).rangeDatePicker?.[0] ?? null;
    const vt = (p as any).validTo ?? (p as any).rangeDatePicker?.[1] ?? null;

    const productId = (p as any).id; // en tu lista viene como p.id
    const flagIsPP = (p as any).isParcialPayment; // puede venir undefined
    const fallbackCount = Math.max(2, Number((p as any).partialPaymentsCount ?? 2));
    const vfp = (p as any).validFromPartial ?? null;
    const vtp = (p as any).validToPartial ?? null;


    this.editForm.reset({
      name: p.name ?? '',
      description: (p as any).description ?? '',
      category: (p as any).category ?? '',
      type: (p as any).type ?? 'Servicio',
      price: Number((p as any).price ?? 0),
      active: !!(p as any).active,
      validFrom: vf ? this.toInputDate(vf) : '',
      validTo: vt ? this.toInputDate(vt) : '',
      transportType: (p as any).transportType ?? '',
      amountTrips: Number((p as any).amountTrips ?? 0),
      isTaskIn: (p as any).isTaskIn ?? true,
      isTaskOut: (p as any).isTaskOut ?? true,
      isCalculate: (p as any).isCalculate ?? false,
      disable: (p as any).disable ?? false,
      validFromPartial: vfp ? this.toInputDate(vfp) : '',
      validToPartial: vtp ? this.toInputDate(vtp) : '',
      isParcialPayment: !!flagIsPP,
      partialPaymentsCount: fallbackCount,
      partialPaymentAmount: 0,
      imageFile: null,
    });

    this.editPartialPaymentsFA.clear();

    if (!productId) return;

    try {
      // ✅ TU SERVICIO regresa Observable => aquí lo convertimos a array
      const docs = await firstValueFrom(
        this.productsSvc.getPartialPayments(this.customerId, productId, true)
      );

      const hasDocs = docs.length > 0;
      const isPP = (flagIsPP === true) || hasDocs;

      this.editForm.get('isParcialPayment')?.setValue(isPP, { emitEvent: false });

      if (isPP) {
        if (hasDocs) {
          docs.forEach((d: any) => {
            this.editPartialPaymentsFA.push(
              this.createPartialRow(
                this.toInputDate(d.startsAt),
                this.toInputDate(d.endsAt),
                Number(d.amount ?? 0)
              )
            );
          });

          this.editForm.get('partialPaymentsCount')?.setValue(docs.length, { emitEvent: false });
          this.recomputeEditBaseAmount();
        } else {
          this.rebuildEditPartialPayments(fallbackCount);
        }
      } else {
        this.editPartialPaymentsFA.clear();
        this.editForm.get('partialPaymentsCount')?.setValue(2, { emitEvent: false });
        this.editForm.get('partialPaymentAmount')?.setValue(0, { emitEvent: false });
      }

      this.zone.run(() => this.cdr.detectChanges());
    } catch (e) {
      console.error('getPartialPayments error:', e);
      if (flagIsPP === true) {
        this.rebuildEditPartialPayments(fallbackCount);
        this.zone.run(() => this.cdr.detectChanges());
      }
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.selected = undefined;
    this.editForm.reset();
  }

  onAddFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    this.selectedFile = file;
    this.selectedFileName = file.name;
    this.addForm.patchValue({ imageFile: file });
    this.addForm.get('imageFile')?.updateValueAndValidity();

    if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
    this.imagePreviewUrl = URL.createObjectURL(file);

    this.cdr.detectChanges();
  }

  onEditFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.editForm.patchValue({ imageFile: file });
  }

  async createProduct() {
    if (this.addForm.invalid || this.saving) return;

    const isPP = !!this.addForm.get('isParcialPayment')?.value;
    if (isPP && !this.partialMatchesTotal) return;

    try {
      this.saving = true;

      const file = this.addForm.value.imageFile!;
      const imageUrl = await this.productsSvc.uploadProductImage(file, this.customerId);

      const validFromTs = this.fromInputDate(this.addForm.value.validFrom!);
      const validToTs = this.fromInputDate(this.addForm.value.validTo!);
      const vfp = this.addForm.value.validFromPartial;
      const vtp = this.addForm.value.validToPartial;


      const productData: any = {
        name: this.addForm.value.name!,
        description: this.addForm.value.description!,
        category: this.addForm.value.category ?? '',
        type: this.addForm.value.type ?? 'Servicio',
        price: Number(this.addForm.value.price ?? 0),
        active: !!this.addForm.value.active,
        imageUrl,
        validFrom: validFromTs,
        validTo: validToTs,
        rangeDatePicker: [validFromTs, validToTs],
        validFromPartial: vfp ? this.fromInputDate(vfp) : null,
        validToPartial: vtp ? this.fromInputDate(vtp) : null,
        transportType: this.addForm.value.transportType ?? '',
        amountTrips: Number(this.addForm.value.amountTrips ?? 0),
        isTaskIn: !!this.addForm.value.isTaskIn,
        isTaskOut: !!this.addForm.value.isTaskOut,
        isCalculate: !!this.addForm.value.isCalculate,
        disable: !!this.addForm.value.disable,

        isParcialPayment: isPP,
        partialPaymentsCount: Number(this.addForm.value.partialPaymentsCount ?? 0),

        sits: 0,
        timesSold: 0,
        frequencies: null,
        rangeWeeks: {},
        weeks: [],
      };


      const productId = await this.productsSvc.addProduct(this.customerId, productData);

      if (isPP) {
        const rows = this.partialPaymentsFA.getRawValue() as {
          startsAt: string;
          endsAt: string;
          amount: number;
        }[];

        const payments = rows.map((r, index) => ({
          active: true,
          amount: Number(r.amount ?? 0),
          startsAt: this.fromInputDate(r.startsAt),
          endsAt: this.fromInputDate(r.endsAt),
          paymentNumber: index + 1,
        }));

        await this.productsSvc.createPartialPayments(this.customerId, productId, payments);
      }

      this.notification.success('Se guardó el producto con éxito', 'And Informa');

      this.partialPaymentsFA.clear();

      this.addForm.reset({
        imageFile: null,
        name: '',
        description: '',
        category: 'permanente',
        type: 'Servicio',
        price: 0,
        active: true,
        validFrom: '',
        validTo: '',
        validFromPartial: '',
        validToPartial: '',
        transportType: '',
        amountTrips: 0,
        isTaskIn: true,
        isTaskOut: true,
        isCalculate: false,
        disable: false,
        isParcialPayment: false,
        partialPaymentsCount: 2,
        partialPaymentAmount: 0,
      });

      this.setTab('active');

      if (this.imagePreviewUrl) URL.revokeObjectURL(this.imagePreviewUrl);
      this.imagePreviewUrl = null;
      this.selectedFileName = '';
      this.selectedFile = null;
    } finally {
      this.saving = false;
    }
  }

  async saveEdit() {
    if (!(this.selected as any)?.id || this.editForm.invalid || this.saving) return;

    const productId = (this.selected as any).id;
    const isPP = !!this.editForm.get('isParcialPayment')?.value;

    if (isPP && !this.editPartialMatchesTotal) return;

    try {
      this.saving = true;

      let imageUrl = (this.selected as any).imageUrl;
      const newFile = this.editForm.value.imageFile;
      if (newFile) imageUrl = await this.productsSvc.uploadProductImage(newFile, this.customerId);

      const validFromTs = this.fromInputDate(this.editForm.value.validFrom!);
      const validToTs = this.fromInputDate(this.editForm.value.validTo!);
      const vfp = this.editForm.value.validFromPartial;
      const vtp = this.editForm.value.validToPartial;

      await this.productsSvc.updateProduct(this.customerId, productId, {
        name: this.editForm.value.name!,
        description: this.editForm.value.description!,
        category: this.editForm.value.category ?? '',
        type: this.editForm.value.type ?? 'Servicio',
        price: Number(this.editForm.value.price ?? 0),
        active: !!this.editForm.value.active,
        imageUrl,
        validFrom: validFromTs,
        validTo: validToTs,
        rangeDatePicker: [validFromTs, validToTs],
        transportType: this.editForm.value.transportType ?? '',
        amountTrips: Number(this.editForm.value.amountTrips ?? 0),
        isTaskIn: !!this.editForm.value.isTaskIn,
        isTaskOut: !!this.editForm.value.isTaskOut,
        isCalculate: !!this.editForm.value.isCalculate,
        disable: !!this.editForm.value.disable,

        isParcialPayment: isPP,
        partialPaymentsCount: isPP ? Number(this.editForm.value.partialPaymentsCount ?? 0) : 0,
        partialPaymentAmount: isPP ? Number(this.editForm.get('partialPaymentAmount')?.value ?? 0) : 0,
        validFromPartial: vfp ? this.fromInputDate(vfp) : null,
        validToPartial: vtp ? this.fromInputDate(vtp) : null,
      } as any);

      if (isPP) {
        const rows = this.editPartialPaymentsFA.getRawValue() as { startsAt: string; endsAt: string; amount: number }[];

        const payments = rows.map(r => ({
          active: true,
          amount: Number(r.amount ?? 0),
          startsAt: this.fromInputDate(r.startsAt),
          endsAt: this.fromInputDate(r.endsAt),
        }));

        await this.productsSvc.replacePartialPayments(this.customerId, productId, payments);
      } else {
        await this.productsSvc.replacePartialPayments(this.customerId, productId, []);
      }

      this.notification.success('Se actualizó el producto con éxito', 'And Informa');
      this.closeModal();
    } finally {
      this.saving = false;
    }
  }

  async toggleActive(p: Product) {
    const id = (p as any).id;
    if (!id) return;
    await this.productsSvc.updateProduct(this.customerId, id, { active: !(p as any).active } as any);
  }

  async toggleActiveSelected() {
    const id = (this.selected as any)?.id;
    if (!id) return;
    await this.productsSvc.updateProduct(this.customerId, id, { active: !(this.selected as any).active } as any);
  }

  private fromInputDate(value: string): Timestamp {
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return Timestamp.fromDate(dt);
  }

  // ✅ acepta Timestamp | Date | string | null
  private toInputDate(ts: any): string {
    const date: Date =
      ts?.toDate ? ts.toDate()
        : ts instanceof Date ? ts
          : ts ? new Date(ts)
            : new Date();

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  get partialPaymentsFA(): FormArray {
    return this.addForm.get('partialPayments') as FormArray;
  }

  get partialPaymentsControls(): AbstractControl[] {
    return this.partialPaymentsFA.controls;
  }

  get partialPaymentsTotal(): number {
    const total = this.partialPaymentsFA.controls.reduce((acc, c) => {
      const v = Number(c.get('amount')?.value ?? 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return Math.round(total * 100) / 100;
  }

  get priceValue(): number {
    return Number(this.addForm.get('price')?.value ?? 0);
  }

  get partialMatchesTotal(): boolean {
    return Math.round(this.partialPaymentsTotal * 100) === Math.round(this.priceValue * 100);
  }

  private createPartialRow(startsAt = '', endsAt = '', amount = 0): FormGroup {
    return this.fb.group({
      startsAt: [startsAt, Validators.required],
      endsAt: [endsAt, Validators.required],
      amount: [amount, [Validators.required, Validators.min(0.01)]],
    });
  }

  private dateToInput(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private rebuildPartialPayments(n: number) {
    const fa = this.partialPaymentsFA;
    fa.clear();

    const fromStr = (this.addForm.get('validFromPartial')?.value as string) || '';
    const toStr = (this.addForm.get('validToPartial')?.value as string) || '';

    const price = this.priceValue;

    if (!fromStr || !toStr) {
      for (let i = 0; i < n; i++) fa.push(this.createPartialRow('', '', 0));
      return;
    }

    const start = new Date(fromStr + 'T12:00:00');
    const end = new Date(toStr + 'T12:00:00');
    const totalMs = end.getTime() - start.getTime();
    const step = totalMs > 0 ? totalMs / n : 0;

    const base = n > 0 ? Math.floor((price / n) * 100) / 100 : 0;
    const amounts = Array.from({ length: n }, () => base);
    const sumBase = Math.round(base * n * 100) / 100;
    const diff = Math.round((price - sumBase) * 100) / 100;
    if (n > 0) amounts[n - 1] = Math.round((amounts[n - 1] + diff) * 100) / 100;

    for (let i = 0; i < n; i++) {
      const s = step ? new Date(start.getTime() + step * i) : start;
      const e = i === n - 1 ? end : (step ? new Date(start.getTime() + step * (i + 1)) : end);
      fa.push(this.createPartialRow(this.dateToInput(s), this.dateToInput(e), amounts[i]));
    }
  }

  get editPartialPaymentsFA(): FormArray {
    return this.editForm.get('partialPayments') as FormArray;
  }

  get editPartialPaymentsControls(): AbstractControl[] {
    return this.editPartialPaymentsFA.controls;
  }

  get editPriceValue(): number {
    return Number(this.editForm.get('price')?.value ?? 0);
  }

  get editPartialPaymentsTotal(): number {
    const total = this.editPartialPaymentsFA.controls.reduce((acc, c) => {
      const v = Number(c.get('amount')?.value ?? 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return Math.round(total * 100) / 100;
  }

  get editPartialMatchesTotal(): boolean {
    return Math.round(this.editPartialPaymentsTotal * 100) === Math.round(this.editPriceValue * 100);
  }

  private rebuildEditPartialPayments(n: number) {
    const fa = this.editPartialPaymentsFA;
    fa.clear();

    const fromStr =
      (this.editForm.get('validFromPartial')?.value as string) ||
      (this.editForm.get('validFrom')?.value as string) ||
      '';

    const toStr =
      (this.editForm.get('validToPartial')?.value as string) ||
      (this.editForm.get('validTo')?.value as string) ||
      '';

    const price = this.editPriceValue;

    if (!fromStr || !toStr) {
      for (let i = 0; i < n; i++) fa.push(this.createPartialRow('', '', 0));
      this.recomputeEditBaseAmount();
      return;
    }

    const start = new Date(fromStr + 'T12:00:00');
    const end = new Date(toStr + 'T12:00:00');
    const totalMs = end.getTime() - start.getTime();
    const step = totalMs > 0 ? totalMs / n : 0;

    const base = Math.floor((price / n) * 100) / 100;
    const amounts = Array.from({ length: n }, () => base);
    const sumBase = Math.round(base * n * 100) / 100;
    const diff = Math.round((price - sumBase) * 100) / 100;
    amounts[n - 1] = Math.round((amounts[n - 1] + diff) * 100) / 100;

    for (let i = 0; i < n; i++) {
      const s = step ? new Date(start.getTime() + step * i) : start;
      const e = i === n - 1 ? end : (step ? new Date(start.getTime() + step * (i + 1)) : end);
      fa.push(this.createPartialRow(this.dateToInput(s), this.dateToInput(e), amounts[i]));
    }

    this.recomputeEditBaseAmount();
  }

  private recomputeEditBaseAmount() {
    const n = this.editPartialPaymentsFA.length || Number(this.editForm.get('partialPaymentsCount')?.value ?? 0);
    const price = this.editPriceValue;
    const base = n > 0 ? Math.floor((price / n) * 100) / 100 : 0;
    this.editForm.get('partialPaymentAmount')?.setValue(base, { emitEvent: false });
  }

  autoDistributeAmounts() {
    const n = this.partialPaymentsFA.length;
    const price = this.priceValue;
    if (!n || price <= 0) return;

    const base = Math.floor((price / n) * 100) / 100;
    const amounts = Array.from({ length: n }, () => base);

    const sumBase = Math.round(base * n * 100) / 100;
    const diff = Math.round((price - sumBase) * 100) / 100;

    // Ajusta el último para cuadrar exacto
    amounts[n - 1] = Math.round((amounts[n - 1] + diff) * 100) / 100;

    this.partialPaymentsFA.controls.forEach((c, i) => {
      c.get('amount')?.setValue(amounts[i]);
    });
  }

  editAutoDistributeAmounts() {
    const n = this.editPartialPaymentsFA.length;
    const price = this.editPriceValue;
    if (!n || price <= 0) return;

    const base = Math.floor((price / n) * 100) / 100;
    const amounts = Array.from({ length: n }, () => base);

    const sumBase = Math.round(base * n * 100) / 100;
    const diff = Math.round((price - sumBase) * 100) / 100;

    amounts[n - 1] = Math.round((amounts[n - 1] + diff) * 100) / 100;

    this.editPartialPaymentsFA.controls.forEach((c, i) => {
      c.get('amount')?.setValue(amounts[i]);
    });
  }

}

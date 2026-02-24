import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, distinctUntilChanged, filter, map, of, Subject, Subscription, switchMap, takeUntil, tap } from 'rxjs';
import { Promotion } from '../../interfaces/promotions.type';
import { PromotionsService } from '../../services/promotions.service';
import { Timestamp } from 'firebase/firestore';
import { CommonModule } from '@angular/common';
import { User1 } from '../../interfaces/user.type';
import { AuthenticationService } from '../../services/authentication.service';

type TabKey = 'active' | 'inactive' | 'add';

@Component({
  selector: 'app-promotions',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './promotions.html',
  styleUrl: './promotions.css',
})
export class PromotionsComponent {
  authService = inject(AuthenticationService);
  tab: TabKey = 'active';
  addForm!: FormGroup;
  editForm!: FormGroup;
  selectedFileName = '';
  customerId!: string;
  promotions: Promotion[] = [];
  imagePreviewUrl: string | null = null;
  selectedFile: File | null = null;
  isModalOpen = false;
  selected?: Promotion;
  private sub?: Subscription;
  saving = false;
  user: any = null;
  private destroy$ = new Subject<void>();

  constructor(    
    private promos: PromotionsService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initForms();
  }

  private initForms() {
    this.addForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      category: [''],
      active: [true, Validators.required],
      validFrom: ['', Validators.required],
      validTo: ['', Validators.required],
      imageFile: [null, Validators.required],
    });

    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(5)]],
      category: [''],
      active: [true, Validators.required],
      validFrom: ['', Validators.required],
      validTo: ['', Validators.required],
      imageFile: [null], // opcional al editar
    });
  }

  ngOnInit(): void {
    this.authService.user$
      .pipe(
        filter((u): u is User1 => !!u?.customerId),
        distinctUntilChanged((a, b) => a.customerId === b.customerId),
        tap((u) => (this.user = u)),
        map((u) => u.customerId!),
        switchMap((cid) => {
          this.customerId = cid;
          return this.promos.promotions$(cid).pipe(
            catchError((err) => {
              console.error('promotions$ error', err);
              return of([] as any[]);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((list) => {
        this.promotions = list ?? [];
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get activePromos() {
    return this.promotions.filter(p => p.active);
  }

  get inactivePromos() {
    return this.promotions.filter(p => !p.active);
  }

  setTab(t: TabKey) {
    this.tab = t;
    this.closeModal();
  }
  openModal(p: Promotion) {
    this.selected = p;
    this.isModalOpen = true;
    this.editForm.reset({
      name: p.name,
      description: p.description,
      category: p.category ?? '',
      active: p.active,
      validFrom: this.toInputDate(p.validFrom),
      validTo: this.toInputDate(p.validTo),
      imageFile: null,
    });
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

    this.selectedFileName = file.name;
    this.addForm.patchValue({ imageFile: file });
    this.addForm.get('imageFile')?.updateValueAndValidity();
    const url = URL.createObjectURL(file);
    this.imagePreviewUrl = url;
    this.cdr.detectChanges();
  }

  onEditFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.editForm.patchValue({ imageFile: file });
  }

  async createPromotion() {
    if (this.addForm.invalid || this.saving) return;
    try {
      this.saving = true;

      const file = this.addForm.value.imageFile!;
      const imageUrl = await this.promos.uploadPromotionImage(file, this.customerId);

      await this.promos.addPromotion(this.customerId, {
        name: this.addForm.value.name!,
        description: this.addForm.value.description!,
        category: this.addForm.value.category ?? '',
        active: !!this.addForm.value.active,
        imageUrl,
        validFrom: this.fromInputDate(this.addForm.value.validFrom!),
        validTo: this.fromInputDate(this.addForm.value.validTo!),
      });

      this.addForm.reset({ active: true, category: '', imageFile: null });
      this.setTab('active');
    } finally {
      this.saving = false;
    }
  }

  async saveEdit() {
    if (!this.selected?.id || this.editForm.invalid || this.saving) return;

    try {
      this.saving = true;

      let imageUrl = this.selected.imageUrl;
      const newFile = this.editForm.value.imageFile;

      if (newFile) {
        imageUrl = await this.promos.uploadPromotionImage(newFile, this.customerId);
      }
      await this.promos.updatePromotion(this.customerId, this.selected.id, {
        name: this.editForm.value.name!,
        description: this.editForm.value.description!,
        category: this.editForm.value.category ?? '',
        active: !!this.editForm.value.active,
        imageUrl,
        validFrom: this.fromInputDate(this.editForm.value.validFrom!),
        validTo: this.fromInputDate(this.editForm.value.validTo!),
      });
      this.closeModal();
    } finally {
      this.saving = false;
    }
  }

  async toggleActive(p: Promotion) {
    if (!p.id) return;
    await this.promos.updatePromotion(this.customerId, p.id, { active: !p.active });
  }

  private fromInputDate(value: string): Timestamp {
    const [y, m, d] = value.split('-').map(Number);
    const dt = new Date(y, m - 1, d, 12, 0, 0);
    return Timestamp.fromDate(dt);
  }

  private toInputDate(ts: any): string {
    const date: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async toggleActiveSelected() {
    if (!this.selected?.id) return;
    await this.promos.updatePromotion(this.customerId, this.selected.id, {
      active: !this.selected.active
    });
  }

}
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { distinctUntilChanged, filter, finalize, map, Observable, Subject, Subscription, takeUntil, tap } from 'rxjs';
import { AuthenticationService } from '../../services/authentication.service';
import { userService } from '../../services/user.service';
import { User1 } from '../../interfaces/user.type';
import { CustomersService } from '../../services/customer.service';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Storage } from '@angular/fire/storage';

@Component({
  selector: 'app-crm-component',
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './crm-component.html',
  styleUrl: './crm-component.css',
})
export class CrmComponent {
  objectForm!: UntypedFormGroup;
  stopSubscription$ = new Subject<void>();
  loading = true;
  record: any;
  paymentMethods: any = [];
  infoLoad: any = [];
  userlevelAccess: string | undefined;
  user: any;
  accountsSubscription!: Subscription;
  authService = inject(AuthenticationService);
  userService = inject(userService);
  customerService = inject(CustomersService);
  jobType: any[] = [];
  usersList: any[] = [];
  fallbackAvatar = 'assets/images/logo/avatar.png'; // pon aquí tu default real
  avatarPreviewUrl: string | null = null;
  uploading = false;
  bucketPath = 'customers'; // sin slash final

  //task!: AngularFireUploadTask;
  uploadPercent!: Observable<number>;
  uploadvalue = 0;
  downloadURL!: Observable<string>;
  customerId: string = "";
  private destroy$ = new Subject<void>();
  private refresh$ = new Subject<void>();

  constructor(private cdr: ChangeDetectorRef,
    private storage: Storage,
    private notification: ToastService,
    private fb: UntypedFormBuilder
  ) { }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopSubscription$.next();
    this.stopSubscription$.complete();
  }

  async ngOnInit() {
    this.createForm();
    this.authService.user$
      .pipe(
        filter((u): u is User1 => !!u?.customerId),
        distinctUntilChanged((a, b) => a.customerId === b.customerId),
        tap((u) => (this.user = u)),
        map((u) => u.customerId!),
        takeUntil(this.destroy$)
      )
      .subscribe((cid) => {
        console.log("Customer ID:", cid);

        this.customerId = cid;
        this.getSubscription();
      });

    this.objectForm.get('jobTypeID')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((uid: string) => this.onJobTypeSelected(uid));

  }

  private async loadUsersByCustomer(cid: string) {
    this.usersList = await this.customerService.getUsersByCustomerOnce(cid);
    // opcional si notas que no refresca la UI en algunos casos
    this.cdr.detectChanges();
  }


  createForm() {
    this.objectForm = this.fb.group({
      active: [false, [Validators.required]],
      imageUrl: [''],
      address: [''],
      paymentResponsible: [1, [Validators.required]],
      name: ['', [Validators.required]],
      socialName: [''],
      rfc: [''],
      addressNumber: [''],
      address2: [''],
      address3: [''],
      zip: [''],
      city: [''],
      state: [''],
      forceStopPoints: [true],
      forceRoute: [true],
      forceRound: [true],
      website: [''],
      phoneNumber: [''],
      jobTypeID: [''],
      custConsecutive: [''],
      primaryContact: [''],
      responsableUser: ['']
    });
  }

  patchForm(record: any) {
    this.objectForm.patchValue({
      active: record.active ?? false,
      imageUrl: record.imageUrl ?? '',
      address: record.address ?? '',
      addressNumber: record.addressNumber ?? '',
      name: record.name ?? '',
      paymentResponsible: record.paymentResponsible ?? 1,
      socialName: record.socialName ?? '',
      rfc: record.rfc ?? '',
      address2: record.address2 ?? '',
      address3: record.address3 ?? '',
      zip: record.zip ?? '',
      city: record.city ?? '',
      state: record.state ?? '',
      forceStopPoints: record.forceStopPoints ?? true,
      forceRoute: record.forceRoute ?? true,
      forceRound: record.forceRound ?? true,
      website: record.website ?? '',
      phoneNumber: record.phoneNumber ?? '',
      jobTypeID: record.jobTypeID ?? '',
      custConsecutive: record.custConsecutive ?? '',
      primaryContact: record.primaryContact ?? '',
      responsableUser: record.responsableUser ?? ''
    });
  }

  async getSubscription() {
    try {
      const record = await this.customerService.getAccount(this.customerId);
      if (!record) {
        this.loading = false;
        return;
      }

      this.record = record;
      this.patchForm(record);

      const paymentMethods = await this.customerService.getPaymentMethods(this.customerId);
      this.paymentMethods = paymentMethods ?? [];

      this.loading = false; // listo
    } catch (err) {
      this.loading = false;
      console.error(err);
    }
  }

  // --- Upload con input file (sin ng-zorro) ---
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // (Opcional) validaciones
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      console.warn('Formato no permitido:', file.type);
      input.value = '';
      return;
    }
    const maxMB = 2;
    if (file.size > maxMB * 1024 * 1024) {
      console.warn(`Imagen demasiado grande. Max ${maxMB}MB`);
      input.value = '';
      return;
    }

    // Preview + upload
    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreviewUrl = typeof reader.result === 'string' ? reader.result : null;
      if (this.avatarPreviewUrl) this.uploadToFirebase(file, this.avatarPreviewUrl);
    };
    reader.readAsDataURL(file);

    input.value = ''; // permite seleccionar el mismo archivo otra vez
  }

  private uploadToFirebase(file: File, _base64: string) {
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const filePath = `${this.bucketPath}/${safeName}`;    
    const storageRef = ref(this.storage, filePath);
    this.uploading = true;
    this.uploadvalue = 0;   
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      (snapshot) => {
        this.uploadvalue = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        this.uploading = this.uploadvalue > 0 && this.uploadvalue < 100;
      },
      (error) => {
        console.error('Upload error:', error);
        this.uploading = false;
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        this.updatePhotoURL(url);
        this.uploading = false;
      }
    );
  }
  updatePhotoURL(url: string) {
    this.objectForm.get('imageUrl')?.patchValue(url);
    this.avatarPreviewUrl = url; // opcional: que el preview ya sea la URL final

    // aquí ya puedes persistirlo en firestore:
     this.customerService.updateAvatarAccount(this.customerId, url);
    this.notification.success('Imagen subida correctamente', 'And Informa');

  }

  onSubmit() {
    if (this.objectForm.invalid) {
      this.objectForm.markAllAsTouched();
      return;
    }
    this.customerService.updateAccount(this.customerId, this.objectForm.value)
      .then(() => this.notification.success('Actualizado correctamente', 'And Informa'))
      .catch(err => this.notification.error('Error al actualizar', 'And Informa'));

  }

  onJobTypeSelected(uid: string) {
    if (!uid) return;

    const found = this.jobType.find((j: any) => j.uid === uid);
    if (!found) return;

    let consecutive = parseInt(found.consecutive, 10) + 1;
    const padded = consecutive.toString().padStart(4, '0');
    this.objectForm.controls['custConsecutive'].setValue(`${found.type}${padded}`);
  }

  async onTogglePaymentMethod(pm: any) {
    pm.active = !pm.active;

    this.customerService.updateAccountPayment(this.customerId, pm.id, pm.active)
      .then(() => this.notification.success('Actualizado correctamente', 'And Informa'))
      .catch(err => this.notification.error('Error al actualizar', 'And Informa'));

  }
}
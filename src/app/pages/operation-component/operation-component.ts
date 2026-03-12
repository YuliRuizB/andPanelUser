import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, inject, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthenticationService } from '../../services/authentication.service';
import { distinctUntilChanged, filter, map, Subject, takeUntil, tap } from 'rxjs';
import { CustomerRoute, stops, User1 } from '../../interfaces/user.type';
import { RoutesService } from '../../services/routes.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-operation-component',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './operation-component.html',
  styleUrl: './operation-component.css',
})
export class OperationComponent {

  private cdr = inject(ChangeDetectorRef);
  authService = inject(AuthenticationService);
  routes = inject(RoutesService);
  fb = inject(FormBuilder);

  private ngZone = inject(NgZone);
  nameFilter: string = '';
  user: User1 | null = null;
  users: User1[] = [];
  customerId: string = "";
  private destroy$ = new Subject<void>();
  loadingRoutes = false;
  routesList: CustomerRoute[] = [];
  routesFiltered: CustomerRoute[] = [];
  pageSizeRoutes = 10;
  currentPageRoutes = 1;
  selectedRoute: any = null;
  routeDetail: any = null;
  routePoints: stops[] = [];
  detailTab: 'detalle' | 'puntos' = 'detalle';
  loadingDetail = false;
  isEditing = false;
  isSaving = false;
  routeEditForm = this.fb.group({
    name: ['', [Validators.required]],
    description: [''],
    kmzUrl: [''],
  });
  isCreating = false;
  openMenuIndex: number | null = null;
  openMenuId: string | null = null;
  showCreatePointModal = false;
  savingPoint = false;
  pointForm!: FormGroup;
  pagedRoutePoints: stops[] = [];

  pageSizePoints = 4;
  currentPagePoints = 1;
  isEditingPoint = false;
  editingPoint: any = null;



  constructor(private notification: ToastService) {
    this.initPointForm();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }
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
        this.loadRoutes();
        this.cdr.detectChanges();
      });

  }

  applyFilters() {
    this.ngZone.run(() => {
      this.cdr.detectChanges();
    });
  }

  loadRoutes() {
    this.loadingRoutes = true;
    this.routesList = [];
    this.routesFiltered = [];
    this.currentPageRoutes = 1;

    this.routes.getRoutes(this.customerId)
      .then((r) => {
        this.routesList = r || [];
        this.routesFiltered = [...this.routesList];
        this.loadingRoutes = false;
        this.cdr.markForCheck();       
      })
      .catch((err) => {
       this.notification.error('Error al cargar las rutas ' + err, 'And Informa');
        this.loadingRoutes = false;
        this.routesList = [];
        this.routesFiltered = [];
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalPagesRoutes(): number {
    return Math.max(1, Math.ceil(this.routesFiltered.length / this.pageSizeRoutes));
  }

  get pagedRoutes(): CustomerRoute[] {
    const start = (this.currentPageRoutes - 1) * this.pageSizeRoutes;
    return this.routesFiltered.slice(start, start + this.pageSizeRoutes);
  }

  applyRouteFilters() {
    const q = (this.nameFilter || '').trim().toLowerCase();

    const match = (r: any) => {
      if (!q) return true;
      return (
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.routeId || '').toLowerCase().includes(q)
      );
    };

    this.routesFiltered = (this.routesList || []).filter(match);
    this.currentPageRoutes = 1;
    this.cdr.markForCheck();
  }

  prevRoutesPage() {
    if (this.currentPageRoutes > 1) this.currentPageRoutes--;
  }

  nextRoutesPage() {
    if (this.currentPageRoutes < this.totalPagesRoutes) this.currentPageRoutes++;
  }

  async selectRoute(r: any) {
    this.selectedRoute = r;
    this.isCreating = false;
    this.detailTab = 'detalle';
    await this.loadRouteDetail();
  }

  async loadRouteDetail() {
    if (!this.selectedRoute?.id || !this.customerId) return;

    this.loadingDetail = true;
    this.routeDetail = null;
    this.routePoints = [];
    this.currentPagePoints = 1;

    try {
      this.routeDetail = await this.routes.getRouteDetail(this.customerId, this.selectedRoute.id);
      this.routePoints = await this.routes.getRouteStops(this.customerId, this.selectedRoute.id);
      this.currentPagePoints = 1;
    } catch (e) {
      this.notification.error('Error al cargar el detalle de la ruta ' + e, 'And Informa');
    } finally {
      this.loadingDetail = false;
      this.cdr.markForCheck();
    }
  }

  setDetailTab(t: 'detalle' | 'puntos') {
    this.detailTab = t;
  }

  getHour(round?: string): string {
    if (!round) return '--';
    return round.split(':')[0] || '--';
  }

  getMinutes(round?: string): string {
    if (!round) return '--';
    return round.split(':')[1] || '--';
  }

  startEdit() {
    const d: any = this.routeDetail || this.selectedRoute;
    this.routeEditForm.patchValue({
      name: d?.name ?? '',
      description: d?.description ?? '',
      kmzUrl: d?.kmzUrl ?? '',
    }, { emitEvent: false });

    this.isEditing = true;
    this.cdr.markForCheck();
  }

  cancelEdit() {
    this.isEditing = false;
    if (this.isCreating) {
      this.isCreating = false;
      this.selectedRoute = null;
      this.routeDetail = null;
      this.routePoints = [];
      this.currentPagePoints = 1;
    }

    this.cdr.markForCheck();
  }

  async saveRouteFields() {
    if (!this.customerId) return;

    if (this.routeEditForm.invalid) {
      this.routeEditForm.markAllAsTouched();
      return;
    }

    const v = this.routeEditForm.value;

    const payload = {
      name: (v.name ?? '').trim(),
      description: (v.description ?? '').trim(),
      kmzUrl: (v.kmzUrl ?? '').trim(),
      active: true,
      customerId: this.customerId,
    };

    try {
      this.isSaving = true;
      if (this.isCreating) {
        const newId = await this.routes.createRoute(this.customerId, payload);
        this.notification.success('Operación creada correctamente', 'And Informa');
        this.isCreating = false;
        this.isEditing = false;

        await this.loadRoutes();
        const created = this.routesList.find(x => x.id === newId);
        if (created) {
          await this.selectRoute(created);
        } else {
          this.selectedRoute = null;
          this.routeDetail = null;
        }
        return;
      }

      if (!this.selectedRoute?.id) return;
      await this.routes.updateRouteFields(this.customerId, this.selectedRoute.id, payload);
      const patch = { ...payload };
      this.routeDetail = { ...(this.routeDetail || {}), ...patch };
      this.selectedRoute = { ...(this.selectedRoute || {}), ...patch };
      this.routesList = this.routesList.map(r => r.id === this.selectedRoute.id ? ({ ...r, ...patch }) : r);
      this.routesFiltered = this.routesFiltered.map(r => r.id === this.selectedRoute.id ? ({ ...r, ...patch }) : r);

      this.isEditing = false;
      this.notification.success('Cambios guardados correctamente', 'And Informa');

    } catch (e) {
      this.notification.error('Error al guardar los cambios ' + e, 'And Informa');    
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  toggleMenu(id: string) {
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  toggleRouteStatus(route: any) {
    if (route.active) {
      this.disableRoute(route);
    } else {
      this.enableRoute(route);
    }
  }

  disableRoute(route: CustomerRoute) {
    this.routes.updateRouteInactive(this.customerId, route.id, { active: false })
      .then(() => {
        this.notification.success('Ruta Desactivada correctamente', 'And Informa');
        this.loadRoutes();
      })
      .catch((err) => {
        this.notification.error('Error al desactivar la ruta ' + err, 'And Informa');
      });
  }

  enableRoute(route: CustomerRoute) {
    this.routes.updateRouteInactive(this.customerId, route.id, { active: true })
      .then(() => {
        this.notification.success('Ruta activada correctamente', 'And Informa');
        this.loadRoutes();
      })
      .catch((err) => {        
        this.notification.error('Error al activar la ruta ' + err, 'And Informa');
      });
  }

  deleteRoute(route: CustomerRoute) {
    this.routes.deleteRoute(route.id, this.customerId)
      .then(() => {
        this.notification.success('Ruta eliminada correctamente', 'And Informa');
        this.loadRoutes();
      })
      .catch((err) => {        
        this.notification.error('Error al eliminar la ruta ' + err, 'And Informa');
      });
  }


  openCreateRoute() {
    this.isCreating = true;
    this.detailTab = 'detalle';
    this.loadingDetail = false;

    this.selectedRoute = {
      id: '__new__',
      active: true,
      name: '',
      description: '',
      kmzUrl: '',
    };

    this.routeDetail = { ...this.selectedRoute };
    this.routePoints = [];
    this.currentPagePoints = 1;

    this.routeEditForm.reset(
      { name: '', description: '', kmzUrl: '' },
      { emitEvent: false }
    );

    this.isEditing = true;
    this.cdr.markForCheck();
  }

  toggleMenuIndex(index: number): void {
    this.openMenuIndex = this.openMenuIndex === index ? null : index;
  }

  generateQR(point: any) {
    console.log('QR', point);
  }

  async toggleActive(point: any) {
    point.active = !point.active;
    this.routes.toggleActiveStopPoint(this.customerId, this.selectedRoute.id, point.id, point.active)
      .then(async () => {
        await this.routes.updatePolyline(this.customerId, this.selectedRoute.id);
        this.notification.success(`Punto ${point.active ? 'activado' : 'desactivado'} correctamente`, 'And Informa');
        this.loadRouteDetail();
      })
      .catch((err) => {
        console.error(err);
        this.notification.error(`Error al ${point.active ? 'activar' : 'desactivar'} el punto ` + err, 'And Informa');
      });
  }

  async refreshPolyline() {
    if (!this.customerId || !this.selectedRoute?.id) return;

    try {
      await this.routes.updatePolyline(this.customerId, this.selectedRoute.id);
      console.log('Polyline actualizada');
    } catch (error) {
      console.error(error);
    }
  }

  closeMenu(): void {
    this.openMenuIndex = null;
  }

  editPoint(point: any) {
    this.isEditingPoint = true;
    this.editingPoint = point;

    this.pointForm.patchValue({
      name: point?.name ?? '',
      description: point?.description ?? '',
      latitude: point?.geopoint?.latitude ?? point?.latitude ?? null,
      longitude: point?.geopoint?.longitude ?? point?.longitude ?? null,

      round1Hour: point?.rounds?.round1 ?? '',
      round2Hour: point?.rounds?.round2 ?? '',
      round3Hour: point?.rounds?.round3 ?? '',

      round1MinutesSinceStart: point?.round1MinutesSinceStart ?? 0,
      round2MinutesSinceStart: point?.round2MinutesSinceStart ?? 0,
      round3MinutesSinceStart: point?.round3MinutesSinceStart ?? 0,

      order: point?.order ?? 0
    });

    this.showCreatePointModal = true;
  }

  deletePoint(point: any) {
    console.log('Eliminar', point);
  }

  initPointForm() {
    this.pointForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      latitude: [null, Validators.required],
      longitude: [null, Validators.required],

      round1Hour: [''],
      round2Hour: [''],
      round3Hour: [''],

      round1MinutesSinceStart: [0],
      round2MinutesSinceStart: [0],
      round3MinutesSinceStart: [0],

      order: [0, Validators.required]
    });
  }

  openCreatePointModal() {
    this.isEditingPoint = false;
    this.editingPoint = null;

    this.pointForm.reset({
      name: '',
      description: '',
      latitude: null,
      longitude: null,
      round1Hour: '',
      round2Hour: '',
      round3Hour: '',
      round1MinutesSinceStart: 0,
      round2MinutesSinceStart: 0,
      round3MinutesSinceStart: 0,
      order: this.routePoints?.length ?? 0
    });

    this.showCreatePointModal = true;
    this.cdr.detectChanges();
  }

  closeCreatePointModal() {
    this.showCreatePointModal = false;
    this.isEditingPoint = false;
    this.editingPoint = null;
    this.pointForm.reset();
  }

  async createPoint() {
    if (!this.selectedRoute?.id || !this.customerId) return;

    this.pointForm.markAllAsTouched();
    if (this.pointForm.invalid) return;

    this.savingPoint = true;

    try {
      const formValue = this.pointForm.value;

      const payload = {
        name: formValue.name,
        description: formValue.description,
        active: true,
        latitude: Number(formValue.latitude),
        longitude: Number(formValue.longitude),
        geopoint: {
          latitude: Number(formValue.latitude),
          longitude: Number(formValue.longitude)
        },
        order: Number(formValue.order),

        rounds: {
          round1: formValue.round1Hour || null,
          round2: formValue.round2Hour || null,
          round3: formValue.round3Hour || null
        },

        round1MinutesSinceStart: Number(formValue.round1MinutesSinceStart || 0),
        round2MinutesSinceStart: Number(formValue.round2MinutesSinceStart || 0),
        round3MinutesSinceStart: Number(formValue.round3MinutesSinceStart || 0),

        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.routes.createStopPoint(this.customerId, this.selectedRoute.id, payload);
      await this.routes.updatePolyline(this.customerId, this.selectedRoute.id);
      await this.loadRouteDetail();

      this.notification.success('Estación creada correctamente', 'And Informa');
      this.closeCreatePointModal();
    } catch (error: any) {
      console.error(error);
      this.notification.error('Error al crear la estación', 'And Informa');
    } finally {
      this.savingPoint = false;
    }
  }

  get totalPagesPoints(): number {
    return Math.max(1, Math.ceil(this.routePoints.length / this.pageSizePoints));
  }

  get pagedRoutePointsList(): stops[] {
    const start = (this.currentPagePoints - 1) * this.pageSizePoints;
    return this.routePoints.slice(start, start + this.pageSizePoints);
  }

  prevPointsPage() {
    if (this.currentPagePoints > 1) {
      this.currentPagePoints--;
    }
  }

  nextPointsPage() {
    if (this.currentPagePoints < this.totalPagesPoints) {
      this.currentPagePoints++;
    }
  }

  async updatePoint() {
    if (!this.selectedRoute?.id || !this.customerId || !this.editingPoint?.id) return;

    this.pointForm.markAllAsTouched();
    if (this.pointForm.invalid) return;

    this.savingPoint = true;

    try {
      const formValue = this.pointForm.value;

      const payload = {
        name: formValue.name,
        description: formValue.description,
        latitude: Number(formValue.latitude),
        longitude: Number(formValue.longitude),
        geopoint: {
          latitude: Number(formValue.latitude),
          longitude: Number(formValue.longitude)
        },
        order: Number(formValue.order),

        rounds: {
          round1: formValue.round1Hour || null,
          round2: formValue.round2Hour || null,
          round3: formValue.round3Hour || null
        },

        round1MinutesSinceStart: Number(formValue.round1MinutesSinceStart || 0),
        round2MinutesSinceStart: Number(formValue.round2MinutesSinceStart || 0),
        round3MinutesSinceStart: Number(formValue.round3MinutesSinceStart || 0),

        updatedAt: new Date()
      };

      await this.routes.updateStopPoint(
        this.customerId,
        this.selectedRoute.id,
        this.editingPoint.id,
        payload
      );

      await this.routes.updatePolyline(this.customerId, this.selectedRoute.id);
      await this.loadRouteDetail();

      this.notification.success('Estación actualizada correctamente', 'And Informa');
      this.closeCreatePointModal();

    } catch (error: any) {
      console.error(error);
      this.notification.error('Error al actualizar la estación', 'And Informa');
    } finally {
      this.savingPoint = false;
    }
  }

  openEditPointModal(point: any, event: MouseEvent) {
    event.stopPropagation();

    this.openMenuIndex = null;
    this.isEditingPoint = true;
    this.editingPoint = point;

    this.pointForm.reset({
      name: point?.name ?? '',
      description: point?.description ?? '',
      latitude: point?.geopoint?.latitude ?? point?.latitude ?? null,
      longitude: point?.geopoint?.longitude ?? point?.longitude ?? null,

      round1Hour: point?.rounds?.round1 ?? '',
      round2Hour: point?.rounds?.round2 ?? '',
      round3Hour: point?.rounds?.round3 ?? '',

      round1MinutesSinceStart: point?.round1MinutesSinceStart ?? 0,
      round2MinutesSinceStart: point?.round2MinutesSinceStart ?? 0,
      round3MinutesSinceStart: point?.round3MinutesSinceStart ?? 0,

      order: point?.order ?? 0
    });

    this.showCreatePointModal = true;
    this.cdr.detectChanges();
  }

}
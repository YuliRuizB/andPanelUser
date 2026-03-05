import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, NgZone } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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

  openMenuId: string | null = null;

  constructor(private notification: ToastService,) {

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
        console.log(r);
      })
      .catch((err) => {
        console.error(err);
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

    try {
      this.routeDetail = await this.routes.getRouteDetail(this.customerId, this.selectedRoute.id);
      this.routePoints = await this.routes.getRouteStops(this.customerId, this.selectedRoute.id);
    } catch (e) {
      console.error(e);
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

      //  CREAR
      if (this.isCreating) {
        // Ajusta este método en tu service (te lo dejo abajo)
        const newId = await this.routes.createRoute(this.customerId, payload);

        this.notification.success('Operación creada correctamente', 'And Informa');

        this.isCreating = false;
        this.isEditing = false;

        // recarga lista y selecciona el nuevo registro
        await this.loadRoutes();

        const created = this.routesList.find(x => x.id === newId);
        if (created) {
          await this.selectRoute(created);
        } else {
          // fallback por si no llega inmediato
          this.selectedRoute = null;
          this.routeDetail = null;
        }

        return;
      }

      //  UPDATE (tu flujo actual)
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
      console.error(e);
      this.notification.error('Error al guardar', 'And Informa');
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
        console.error(err);
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
        console.error(err);
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
        console.error(err);
        this.notification.error('Error al eliminar la ruta ' + err, 'And Informa');
      });
  }


  openCreateRoute() {
    this.isCreating = true;
    this.detailTab = 'detalle';
    this.loadingDetail = false;

    // creamos un "selectedRoute" temporal para que aparezca el panel
    this.selectedRoute = {
      id: '__new__',
      active: true,
      name: '',
      description: '',
      kmzUrl: '',
    };

    // el detail también vacío
    this.routeDetail = { ...this.selectedRoute };
    this.routePoints = []; // en creación no hay puntos

    // dejamos el form listo y entramos a editar
    this.routeEditForm.reset(
      { name: '', description: '', kmzUrl: '' },
      { emitEvent: false }
    );

    this.isEditing = true;
    this.cdr.markForCheck();
  }

}

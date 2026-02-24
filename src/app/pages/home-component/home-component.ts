import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { AuthenticationService } from '../../services/authentication.service';
import { distinctUntilChanged, filter, map, Subject, takeUntil, tap } from 'rxjs';
import { User1 } from '../../interfaces/user.type';
import { HomeService } from '../../services/home.service';

@Component({
  selector: 'app-home-component',
  imports: [CommonModule],
  templateUrl: './home-component.html',
  styleUrl: './home-component.css',
})
export class HomeComponent {
  // chart config
  chartW = 900;
  chartH = 320;

  months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  values = Array(12).fill(0);

  // Layout constants
  paddingLeft = 60;
  paddingTop = 20;
  paddingRight = 20;
  paddingBottom = 40;

  // state
  selectedYear = 2025;
  currentCustomerId: string | null = null;
  isLoadingYear = false;

  // services
  authService = inject(AuthenticationService);
  homeService = inject(HomeService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  // other UI state
  user: User1 | null = null;
  private destroy$ = new Subject<void>();

  totalUsers: string = '0';
  totVendor: string = '0';
  totRoutes: string = '0';
  totRoutesLive: string = '0';
  totDrivers: string = '0';
  activePasses: string = '0';
  totalProducts: string = '0';
  promotions: string = '0';

  constructor() {}

  // ----- chart computed props -----
  get innerW() {
    return this.chartW - this.paddingLeft - this.paddingRight;
  }

  get innerH() {
    return this.chartH - this.paddingTop - this.paddingBottom;
  }

  get maxY() {
    const m = Math.max(...this.values);
    return Math.max(m, 1) * 1.15; // mínimo 1 para no dividir entre 0
  }

  get points() {
    return this.values.map((v, i) => {
      const x = this.paddingLeft + (this.innerW * i) / (this.values.length - 1);
      const y = this.paddingTop + (this.innerH * (1 - v / this.maxY));
      return { x, y, v };
    });
  }

  get polylinePoints() {
    return this.points.map(p => `${p.x},${p.y}`).join(' ');
  }

  get gridLines() {
    const lines = 5;
    return Array.from({ length: lines }, (_, idx) => {
      const t = idx / (lines - 1);
      return this.paddingTop + this.innerH * t;
    });
  }

  get yTicks() {
    const ticks = 5;
    return Array.from({ length: ticks }, (_, idx) => {
      const t = idx / (ticks - 1);
      const value = Math.round(this.maxY * (1 - t));
      const y = this.paddingTop + this.innerH * t;
      return { y, label: value.toString() };
    });
  }

  get xTicks() {
    return this.months.map((label, i) => {
      const x = this.paddingLeft + (this.innerW * i) / (this.months.length - 1);
      return { x, label };
    });
  }

  // ----- lifecycle -----
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
        // No hacemos async directo aquí: llamamos un método async controlado
        this.loadDashboard(cid);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ----- loaders -----
  private async loadDashboard(cid: string) {
    this.currentCustomerId = cid;

    try {
      const [
        count,
        totalRoutes,
        totalUsers,
        vendor,
        drivers,
        passes,
        products,
        promos
      ] = await Promise.all([
        this.homeService.getLiveBussesCountOnce(cid),
        this.homeService.getActiveRoutesCount(cid),
        this.homeService.getActiveUsersCount(cid),
        this.homeService.getActiveVendorCount(cid),
        this.homeService.getActiveDriversCount(cid),
        this.homeService.getActiveBoardingPassesCount(cid),
        this.homeService.getActiveProductsCount(cid),
        this.homeService.getActivePromotionsCount(cid),
      ]);

      // Forzar que Angular “vea” los cambios
      this.ngZone.run(() => {
        this.totRoutesLive = count.toString();
        this.totRoutes = totalRoutes.toString();
        this.totalUsers = totalUsers.toString();
        this.totVendor = vendor.toString();
        this.totDrivers = drivers.toString();
        this.activePasses = passes.toString();
        this.totalProducts = products.toString();
        this.promotions = promos.toString();
      });

      // Cargar chart inicial (año seleccionado)
      await this.changeYear(this.selectedYear, true);
    } finally {
      // asegurar refresco visual
      this.ngZone.run(() => this.cdr.detectChanges());
    }
  }

  async changeYear(year: number, force = false) {
    if (!this.currentCustomerId) return;
    if (this.isLoadingYear) return;
    if (!force && year === this.selectedYear) return;

    this.isLoadingYear = true;

    // (opcional) limpiar para que se note loading
    this.ngZone.run(() => {
      this.selectedYear = year;
      this.values = Array(12).fill(0);
      this.cdr.detectChanges();
    });

    try {
      const data = await this.homeService.getNewUsersCountsByMonth(this.currentCustomerId, year);

      this.ngZone.run(() => {
        this.values = data;
        this.cdr.detectChanges();
      });
    } finally {
      this.ngZone.run(() => {
        this.isLoadingYear = false;
        this.cdr.detectChanges();
      });
    }
  }
}

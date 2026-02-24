import { ChangeDetectorRef, Component, inject, NgZone } from '@angular/core';
import { GoogleMapsModule } from '@angular/google-maps';
import { MapsService } from '../../services/maps.service';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  catchError,
  distinctUntilChanged,
  EMPTY,
  filter,
  forkJoin,
  interval,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  tap
} from 'rxjs';
import { LiveDriver, MapMarkerItem } from '../../interfaces/route.type';
import { AuthenticationService } from '../../services/authentication.service';
import { User1 } from '../../interfaces/user.type';
import { userService } from '../../services/user.service';
import { CommonModule } from '@angular/common';

type RouteOverlay = {
  routeId: string;
  routeName: string;
  color: string;
  path: google.maps.LatLngLiteral[];
  stopMarkers: Array<{ pos: google.maps.LatLngLiteral }>;
};

@Component({
  selector: 'app-maps-component',
  imports: [GoogleMapsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './maps-component.html',
  styleUrl: './maps-component.css',
})
export class MapsComponent {
  zoom = 11;
  private fb = inject(FormBuilder);
  private mapsService = inject(MapsService);
  private userService = inject(userService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  authService = inject(AuthenticationService);
  private destroy$ = new Subject<void>();
  center: google.maps.LatLngLiteral = { lat: 25.6866, lng: -100.3161 };
  routes: any[] = [];
  drivers: LiveDriver[] = [];
  form = this.fb.group({
    routeId: [''],
    id: [''],
    driverId: [''],
  });
  mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
  };
  user: any = null;
  markerIcon: google.maps.Icon = {
    url: 'assets/images/marker_bus33.png',
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 40),
  };
  markerItems: MapMarkerItem[] = [];
  routeOverlays: RouteOverlay[] = [];
  routeOverlaysStreet: RouteOverlay[] = [];
  selectedDriver: any = null;
  showRouteLine = false;
  showRouteLineStreet = false;
  public gm = google.maps;
  private centeredOnce = false;
  stopIcon: google.maps.Icon = {
    url: 'assets/images/stop2.png',
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
  };
  stopMarkerOptions: google.maps.MarkerOptions = {
    zIndex: 200,
  }
  selectedStop: any | null = null;
  isStopModalOpen = false;
  trackByDriver = (_: number, item: any) => {
    return item?.driver?.id ?? item?.driver?.driverId ?? item?.driverId ?? item?.driver?.uid ?? item?.label ?? _;
  };
  trackByRoute = (_: number, r: RouteOverlay) => r.routeId;
  trackByVertex = (i: number) => i;

  constructor() { }

  ngOnInit(): void {
    this.authService.user$
      .pipe(
        filter((u): u is User1 => !!u?.customerId),
        distinctUntilChanged((a, b) => a.customerId === b.customerId),
        tap((u) => (this.user = u)),
        map((u) => u.customerId!),
        switchMap((cid) =>
          interval(5000).pipe(
            startWith(0),
            switchMap(() =>
              this.mapsService.getliveBusses(cid, '').pipe(
                catchError((err) => {
                  console.error('getliveBusses error', err);
                  return EMPTY;
                })
              )
            )
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((drivers) => {
        this.zone.run(() => {
          this.drivers = drivers ?? [];
          this.markerItems = (this.drivers ?? [])
            .map((d: any) => {
              const gp = d?.geopoint;
              const lat = gp?.latitude ?? gp?._lat;
              const lng = gp?.longitude ?? gp?._long;
              if (lat == null || lng == null) return null;
              return {
                pos: { lat, lng } as google.maps.LatLngLiteral,
                driver: d,
                label: `${d.routeName}`,
              };
            })
            .filter(Boolean) as any[];

          if (!this.centeredOnce && this.markerItems.length > 0) {
            this.center = this.markerItems[0].pos;
            this.centeredOnce = true;
          }
        });
      });
  }

  getliveBusses(customerId: string) {
    this.mapsService.getliveBusses(customerId, '')
      .pipe(takeUntil(this.destroy$))
      .subscribe((drivers) => {
        this.zone.run(() => {
          this.drivers = drivers ?? [];
          this.markerItems = this.drivers
            .map((d: any) => {
              const gp = d?.geopoint;
              const lat = gp?.latitude ?? gp?._lat;
              const lng = gp?.longitude ?? gp?._long;
              if (lat == null || lng == null) return null;
              return {
                pos: { lat, lng } as google.maps.LatLngLiteral,
                driver: d,
                label: `${d.routeName}`,
              };
            })
            .filter(Boolean) as any[];
          if (this.markerItems.length > 0) {
            this.center = this.markerItems[0].pos;
          }
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openDriverModal(driver: any) {
    this.selectedDriver = driver;
  }

  closeDriverModal() {
    this.selectedDriver = null;
  }

  formatLastUpdate(ts: any): string {
    if (!ts?.seconds) return 'Sin información';

    const date = new Date(ts.seconds * 1000);
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  toggleRouteLineStreet() {
    this.showRouteLineStreet = !this.showRouteLineStreet;
    if (this.showRouteLineStreet) {
      const customerId = this.user?.customerId;
      if (!customerId) return;
      this.buildRouteOverlaysStreet(customerId);
    } else {
      this.clearRouteOverlaysStreet();
    }
  }

  toggleRouteLine() {
    this.showRouteLine = !this.showRouteLine;
    if (this.showRouteLine) {
      const customerId = this.user?.customerId;
      if (!customerId) return;
      this.buildRouteOverlays(customerId);
    } else {
      this.clearRouteOverlays();
    }
  }

  private toNumber(value: any): number | null {
    if (value == null) return null;
    const n = Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
  }

  private colorFromRouteId(routeId: string): string {
    let hash = 0;
    for (let i = 0; i < routeId.length; i++) {
      hash = (hash * 31 + routeId.charCodeAt(i)) >>> 0;
    }
    const hue = hash % 360;
    return `hsl(${hue}, 85%, 45%)`;
  }

  private buildRouteOverlays(customerId: string) {
    const uniqueRoutes = new Map<string, { routeId: string; routeName: string }>();
    for (const d of (this.drivers ?? [])) {
      const routeId = (d as any)?.routeId || (d as any)?.route_id || (d as any)?.route?.id || this.form.value.routeId;
      if (!routeId) continue;

      uniqueRoutes.set(routeId, {
        routeId,
        routeName: (d as any)?.routeName || (d as any)?.route_name || (d as any)?.route?.name || 'Ruta',
      });
    }

    const routesArr = [...uniqueRoutes.values()];
    if (routesArr.length === 0) {
      this.routeOverlays = [];
      return;
    }

    const requests = routesArr.map((r) =>
      this.mapsService.getStopsByRoute(customerId, r.routeId).pipe(
        take(1),
        map((stops: any[]) => {
          const stopMarkers = (stops ?? [])
            .map((s: any) => {
              const lat = this.toNumber(s?.latitude ?? s?.lat);
              const lng = this.toNumber(s?.longitude ?? s?.lng);
              if (lat == null || lng == null) return null;

              return {
                pos: { lat, lng } as google.maps.LatLngLiteral,
                id: s?.id,
                name: s?.name,
                description: s?.description,
                active: s?.active,
              };
            })
            .filter(Boolean) as any[];

          const points = stopMarkers.map(m => m.pos);
          const color = this.colorFromRouteId(r.routeId);

          return {
            routeId: r.routeId,
            routeName: r.routeName,
            color,
            path: points,
            stopMarkers,
          } as RouteOverlay;
        }),
        catchError(() =>
          of({
            routeId: r.routeId,
            routeName: r.routeName,
            color: this.colorFromRouteId(r.routeId),
            path: [],
            stopMarkers: [],
          } as RouteOverlay)
        )
      )
    );

    forkJoin(requests).subscribe((overlays) => {
      this.routeOverlays = overlays.filter((o) => o.path.length > 0);
      this.cdr.detectChanges();
    });
  }

  private buildRouteOverlaysStreet(customerId: string) {
    const uniqueRoutes = new Map<string, { routeId: string; routeName: string }>();
    for (const d of (this.drivers ?? [])) {
      const routeId = (d as any)?.routeId || (d as any)?.route_id || (d as any)?.route?.id || this.form.value.routeId;
      if (!routeId) continue;
      uniqueRoutes.set(routeId, {
        routeId,
        routeName: (d as any)?.routeName || (d as any)?.route_name || (d as any)?.route?.name || 'Ruta',
      });
    }

    const routesArr = [...uniqueRoutes.values()];
    if (routesArr.length === 0) {
      this.routeOverlaysStreet = [];
      return;
    }

    const requests = routesArr.map((r) =>
      this.mapsService.getCustomersPolyLineCustomer(customerId, r.routeId).pipe(
        take(1),
        map((docs: any[]) => {
          const verticesArr = (docs ?? []).flatMap(
            (d: any) => d?.vertices ?? []
          );
          const points = verticesArr
            .map((v: any) => {
              const lat = this.toNumber(v?.lat);
              const lng = this.toNumber(v?.lng);
              if (lat == null || lng == null) return null;
              return { lat, lng } as google.maps.LatLngLiteral;
            })
            .filter(Boolean) as google.maps.LatLngLiteral[];

          const color = this.colorFromRouteId(r.routeId);
          return {
            routeId: r.routeId,
            routeName: r.routeName,
            color,
            path: points,
            stopMarkers: points.map(p => ({ pos: p })),
          } as RouteOverlay;
        }),

        catchError((err) => {
          console.error('Error polyline route', r.routeId, err);
          return of({
            routeId: r.routeId,
            routeName: r.routeName,
            color: this.colorFromRouteId(r.routeId),
            path: [],
            stopMarkers: [],
          } as RouteOverlay);
        })
      )
    );

    forkJoin(requests).subscribe((overlays) => {
      this.routeOverlaysStreet = overlays.filter((o) => o.path.length > 0);
      this.cdr.detectChanges();
    });

  }

  private clearRouteOverlays() {
    this.routeOverlays = [];
  }

  private clearRouteOverlaysStreet() {
    this.routeOverlaysStreet = [];
  }

  openStopModal(stop: any) {
    this.selectedStop = stop;
    this.isStopModalOpen = true;
  }

  closeStopModal() {
    this.isStopModalOpen = false;
    this.selectedStop = null;
  }

}

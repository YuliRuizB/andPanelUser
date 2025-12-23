import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, HostListener, inject, NgZone, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonEngine } from '@angular/ssr/node';
import { AuthenticationService } from '../../services/authentication.service';
import { filter, take } from 'rxjs';

@Component({
  selector: 'app-initial-component',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './initial-component.html',
  styleUrl: './initial-component.css',
})
export class InitialComponent {
  authService = inject(AuthenticationService);
  sidebarOpen = false;
  openSectionKey: string | null = 'principal';
  isMobile = false;
  user: any = null;
  userMenuOpen = false;
  customerName: string = '';
  pageTitle = '';
  @ViewChild('userMenuWrapper') userMenuWrapper!: ElementRef;

  constructor(private router: Router, private ngZone: NgZone,
    private cdr: ChangeDetectorRef) {
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  ngOnInit() {
    this.onResize();

    // 1) Escuchar usuario
    this.authService.user$
      .pipe(filter((u) => !!u))
      .subscribe((user: any) => {
        this.ngZone.run(async () => {
          this.user = user;

          if (user.customerId) {
            this.customerName = await this.authService.getCustomerName(user.customerId);
          }

          this.cdr.detectChanges();
        });
      });

    // 2) Escuchar cambios de ruta para el título
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.ngZone.run(() => {
          this.updatePageTitle();        
          this.cdr.detectChanges();
        });
      });

    // 3) Llamar una vez al iniciar
    this.updatePageTitle();
  }

  toggleUserMenu(event: MouseEvent) {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeSidebar() {
    if (this.isMobile) {
      this.sidebarOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.userMenuOpen) return;
    const target = event.target as HTMLElement;
    if (this.userMenuWrapper &&
      !this.userMenuWrapper.nativeElement.contains(target)) {
      this.userMenuOpen = false;
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (typeof window === 'undefined') {
      return;
    }
    const width = window.innerWidth;
    this.isMobile = width < 1024;
    this.sidebarOpen = !this.isMobile;
  }

  toggleSection(key: string) {
    this.openSectionKey = this.openSectionKey === key ? null : key;
  }

  isOpen(key: string): boolean {
    return this.openSectionKey === key;
  }

  goToProfile() {
    this.userMenuOpen = false;
    this.router.navigate(['/profile']);
  }

  logout() {
    this.userMenuOpen = false;
    this.router.navigate(['/login']);
  }

  updatePageTitle() {
    const url = this.router.url.split('?')[0];

    const titles: any = {
      '/home': 'Inicio',
      '/maps': 'Mapas',
      '/users': 'Usuarios',
      '/reports': 'Reportes',
      '/attention': 'Atención a Clientes',
      '/validations': 'Validaciones',
      '/live': 'En Vivo',
      '/program': 'Programación',
      '/assignments': 'Asignaciones',
      '/evidence': 'Evidencias',
      '/crm': 'CRM',
      '/division': 'Divisiones',
      '/operation': 'Operaciones del Sistema',
      '/profile': 'Mi Perfil'
    };

    this.pageTitle = titles[url] || '';
  }
}

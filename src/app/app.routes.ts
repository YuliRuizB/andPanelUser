import { Routes } from '@angular/router';
import { LoginComponent } from './authentication/login-component/login-component';
import { InitialComponent } from './layout/initial-component/initial-component';
import { HomeComponent } from './pages/home-component/home-component';
import { MapsComponent } from './pages/maps-component/maps-component';
import { UsersComponent } from './pages/users-component/users-component';
import { ReportsComponent } from './pages/reports-component/reports-component';
import { ValidationsComponent } from './pages/validations-component/validations-component';
import { AttentionComponent } from './pages/attention-component/attention-component';
import { LiveComponent } from './pages/live-component/live-component';
import { ProgramComponent } from './pages/program-component/program-component';
import { AssignComponent } from './pages/assign-component/assign-component';
import { EvidenceComponent } from './pages/evidence-component/evidence-component';
import { CrmComponent } from './pages/crm-component/crm-component';
import { DivisionComponent } from './pages/division-component/division-component';
import { OperationComponent } from './pages/operation-component/operation-component';
import { profile } from 'console';
import { ProfileComponent } from './pages/profile-component/profile-component';
import { ProductsComponent } from './pages/products/products';
import { PromotionsComponent } from './pages/promotions/promotions';
import { BoardingPassComponent } from './pages/boarding-pass/boarding-pass';

export const routes: Routes = [
    // que / redirija a /login
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    // ruta explícita de login
    { path: 'login', component: LoginComponent },

    {
        path: '',
        component: InitialComponent,
        children: [
            { path: 'home', component: HomeComponent },
            { path: 'maps', component: MapsComponent },
            { path: 'users', component: UsersComponent },
            { path: 'reports', component: ReportsComponent },
            { path: 'validations', component: ValidationsComponent },
            { path: 'attention', component: AttentionComponent },
            { path: 'live', component: LiveComponent },
            { path: 'program', component: ProgramComponent },
            { path: 'assignments', component: AssignComponent },
            { path: 'evidence', component: EvidenceComponent },
            { path: 'crm', component: CrmComponent },
            { path: 'division', component: DivisionComponent },
            { path: 'operation', component: OperationComponent },
            { path: 'profile', component: ProfileComponent },
            { path: 'products', component: ProductsComponent }, 
            { path: 'promotions', component: PromotionsComponent }, 
            { path: 'boardingPass', component: BoardingPassComponent },
        ]
    },    
    { path: '**', redirectTo: 'login' }
];

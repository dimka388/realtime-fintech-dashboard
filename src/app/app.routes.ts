import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/pages/dashboard/dashboard').then(
        (module) => module.Dashboard,
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/pages/settings/settings').then(
        (module) => module.Settings,
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];

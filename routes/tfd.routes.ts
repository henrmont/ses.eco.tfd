import { Route, Routes } from '@angular/router';
import { Professionals } from '../enums/professionals';
import { tfdGuard } from '../guards/tfd.guard';

const guardRoute = (
  path: string,
  loadComponent: Route['loadComponent'],
  permission: string,
  types: Professionals[]
): Route => ({
  path,
  loadComponent,
  canActivate: [tfdGuard],
  data: { permission, types },
});

export const tfdRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('../pages/index-page/index.page').then((m) => m.IndexPage),
  },
  guardRoute(
    'usuarios',
    () => import('../pages/users-page/users.page').then((m) => m.UsersPage),
    'usuário listar',
    [Professionals.ADMINISTRADOR]
  ),
  guardRoute(
    'regras',
    () => import('../pages/roles-page/roles.page').then((m) => m.RolesPage),
    'regra listar',
    [Professionals.ADMINISTRADOR]
  ),
  guardRoute(
    'configuracoes',
    () => import('../pages/settings-page/settings.page').then((m) => m.SettingsPage),
    'configuração listar',
    [Professionals.ADMINISTRADOR]
  ),
  guardRoute(
    'pacientes',
    () => import('../pages/patients-page/patients.page').then((m) => m.PatientsPage),
    'paciente listar',
    [Professionals.CADASTRO]
  ),
  guardRoute(
    'arquivo-pacientes',
    () =>
      import('../pages/archive-patients-page/archive-patients.page').then(
        (m) => m.ArchivePatientsPage
      ),
    'paciente listar',
    [Professionals.CADASTRO]
  ),
  guardRoute(
    'solicitacoes',
    () =>
      import('../pages/patient-requests-page/patient-requests.page').then(
        (m) => m.PatientRequestsPage
      ),
    'solicitação listar',
    [Professionals.ADMINISTRATIVO, Professionals.CADASTRO]
  ),
  guardRoute(
    'arquivo-solicitacoes',
    () =>
      import('../pages/archive-patient-requests-page/archive-patient-requests.page').then(
        (m) => m.ArchivePatientRequestsPage
      ),
    'solicitação listar',
    [Professionals.CADASTRO]
  ),
  guardRoute(
    'pareceres-medicos',
    () =>
      import(
        '../pages/patient-request-medical-opinions-page/patient-request-medical-opinions.page'
      ).then((m) => m.PatientRequestMedicalOpinionsPage),
    'parecer listar',
    [Professionals.MEDICO]
  ),
  guardRoute(
    'arquivo-pareceres-medico',
    () =>
      import(
        '../pages/archive-patient-request-medical-opinions-page/archive-patient-request-medical-opinions.page'
      ).then((m) => m.ArchivePatientRequestMedicalOpinionsPage),
    'parecer listar',
    [Professionals.MEDICO, Professionals.ASSISTENTE_SOCIAL]
  ),
  guardRoute(
    'pareceres-sociais',
    () =>
      import(
        '../pages/patient-request-social-opinions-page/patient-request-social-opinions.page'
      ).then((m) => m.PatientRequestSocialOpinionsPage),
    'parecer listar',
    [Professionals.ASSISTENTE_SOCIAL]
  ),
  guardRoute(
    'arquivo-pareceres-social',
    () =>
      import(
        '../pages/archive-patient-request-social-opinions-page/archive-patient-request-social-opinions.page'
      ).then((m) => m.ArchivePatientRequestSocialOpinionsPage),
    'parecer listar',
    [Professionals.MEDICO, Professionals.ASSISTENTE_SOCIAL]
  ),
  guardRoute(
    'passagens',
    () =>
      import('../pages/patient-request-travels-page/patient-request-travels.page').then(
        (m) => m.PatientRequestTravelsPage
      ),
    'passagem listar',
    [Professionals.PASSAGEM]
  ),
  guardRoute(
    'arquivo-passagens',
    () =>
      import(
        '../pages/archive-patient-request-travels-page/archive-patient-request-travels.page'
      ).then((m) => m.ArchivePatientRequestTravelsPage),
    'passagem listar',
    [Professionals.PASSAGEM]
  ),
  guardRoute(
    'ajudas-de-custo',
    () =>
      import(
        '../pages/patient-request-cost-assistances-page/patient-request-cost-assistances.page'
      ).then((m) => m.PatientRequestCostAssistancesPage),
    'ajuda de custo listar',
    [Professionals.AJUDA_DE_CUSTO]
  ),
  guardRoute(
    'arquivo-ajudas-de-custo',
    () =>
      import(
        '../pages/archive-patient-request-cost-assistances-page/archive-patient-request-cost-assistances.page'
      ).then((m) => m.ArchivePatientRequestCostAssistancesPage),
    'ajuda de custo listar',
    [Professionals.AJUDA_DE_CUSTO]
  ),
  guardRoute(
    'prestacao-de-contas',
    () =>
      import(
        '../pages/patient-request-accountabilities-page/patient-request-accountabilities.page'
      ).then((m) => m.PatientRequestAccountabilitiesPage),
    'ajuda de custo listar',
    [Professionals.AJUDA_DE_CUSTO]
  ),
  guardRoute(
    'arquivo-prestacao-de-contas',
    () =>
      import(
        '../pages/archive-patient-request-accountabilities-page/archive-patient-request-accountabilities.page'
      ).then((m) => m.ArchivePatientRequestAccountabilitiesPage),
    'ajuda de custo listar',
    [Professionals.AJUDA_DE_CUSTO]
  ),
  guardRoute(
    'pagamentos',
    () => import('../pages/payments-page/payments.page').then((m) => m.PaymentsPage),
    'pagamento listar',
    [Professionals.PAGAMENTO]
  ),
  guardRoute(
    'arquivo-pagamentos',
    () =>
      import('../pages/archive-payments-page/archive-payments.page').then(
        (m) => m.ArchivePaymentsPage
      ),
    'pagamento listar',
    [Professionals.PAGAMENTO]
  ),
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
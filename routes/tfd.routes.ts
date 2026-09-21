// admin.routes.ts
import { Routes } from '@angular/router';

export const tfdRoutes: Routes = [
    {
        path: '',
        loadComponent: () => import('./../pages/index-page/index-page').then( m => m.IndexPage)
    },
    {
        path: 'usuarios',
        loadComponent: () => import('./../pages/users-page/users.page').then( m => m.UsersPage),
        data: { permission: 'tfd/usuário listar' } // Adicionado
    },
    {
        path: 'regras',
        loadComponent: () => import('./../pages/roles-page/roles.page').then( m => m.RolesPage),
        data: { permission: 'tfd/regra listar' } // Adicionado
    },
    {
        path: 'sigtap',
        loadComponent: () => import('./../pages/sigtap-page/sigtap-page').then( m => m.SigtapPage),
        data: { permission: 'tfd/datasus listar' } // Adicionado
    },
    {
        path: 'configuracoes',
        loadComponent: () => import('./../pages/settings-page/settings.page').then( m => m.SettingsPage),
        data: { permission: 'tfd/configuração listar' } // Adicionado
    },
    {
        path: 'pacientes',
        loadComponent: () => import('./../pages/patients-page/patients.page').then( m => m.PatientsPage),
        data: { permission: 'tfd/paciente listar' } // Adicionado
    },
    {
        path: 'arquivo-pacientes',
        loadComponent: () => import('./../pages/archive-patients-page/archive-patients.page').then( m => m.ArchivePatientsPage),
        data: { permission: 'tfd/paciente listar' } // Adicionado
    },
    {
        path: 'solicitacoes',
        loadComponent: () => import('./../pages/patient-requests-page/patient-requests.page').then( m => m.PatientRequestsPage),
        data: { permission: 'tfd/solicitação listar' } // Adicionado
    },
    {
        path: 'pareceres',
        loadComponent: () => import('./../pages/patient-request-opinions-page/patient-request-opinions.page').then( m => m.PatientRequestOpinionsPage),
        data: { permission: 'tfd/parecer listar' } // Adicionado
    },
    {
        path: 'arquivo-pareceres',
        loadComponent: () => import('./../pages/archive-patient-request-opinions-page/archive-patient-request-opinions.page').then( m => m.ArchivePatientRequestOpinionsPage),
        data: { permission: 'tfd/parecer listar' } // Adicionado
    },
    {
        path: 'passagens',
        loadComponent: () => import('./../pages/patient-request-travels-page/patient-request-travels.page').then( m => m.PatientRequestTravelsPage),
        data: { permission: 'tfd/passagem listar' } // Adicionado
    },
    {
        path: 'arquivo-passagens',
        loadComponent: () => import('./../pages/archive-patient-request-travels-page/archive-patient-request-travels.page').then( m => m.ArchivePatientRequestTravelsPage),
        data: { permission: 'tfd/passagem listar' } // Adicionado
    },
    {
        path: 'ajudas-de-custo',
        loadComponent: () => import('./../pages/patient-request-cost-assistances-page/patient-request-cost-assistances.page').then( m => m.PatientRequestCostAssistancesPage),
        data: { permission: 'tfd/ajuda de custo listar' } // Adicionado
    },
    {
        path: 'arquivo-ajudas-de-custo',
        loadComponent: () => import('./../pages/archive-patient-request-cost-assistances-page/archive-patient-request-cost-assistances.page').then( m => m.ArchivePatientRequestCostAssistancesPage),
        data: { permission: 'tfd/ajuda de custo listar' } // Adicionado
    },
    {
        path: 'prestacoes-de-conta',
        loadComponent: () => import('./../pages/patient-request-accountabilities-page/patient-request-accountabilities.page').then( m => m.PatientRequestAccountabilitiesPage),
        data: { permission: 'tfd/ajuda de custo listar' } // Adicionado
    },
    {
        path: 'arquivo-prestacoes-de-conta',
        loadComponent: () => import('./../pages/archive-patient-request-accountabilities-page/archive-patient-request-accountabilities-page').then( m => m.ArchivePatientRequestAccountabilitiesPage),
        data: { permission: 'tfd/ajuda de custo listar' } // Adicionado
    },
    {
        path: 'pagamentos',
        loadComponent: () => import('./../pages/payments-page/payments.page').then( m => m.PaymentsPage),
        data: { permission: 'tfd/pagamento listar' } // Adicionado
    },
    {
        path: 'arquivo-pagamentos',
        loadComponent: () => import('./../pages/archive-payments-page/archive-payments.page').then( m => m.ArchivePaymentsPage),
        data: { permission: 'tfd/pagamento listar' } // Adicionado
    },
];
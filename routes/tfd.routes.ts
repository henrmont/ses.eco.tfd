import { Routes } from '@angular/router';
import { Professionals } from '../enums/professionals';
import { professionalGuard } from '../../core/guards/professional-guard';

export const tfdRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./../pages/index-page/index.page').then(m => m.IndexPage)
  },
  {
    path: 'usuarios',
    loadComponent: () => import('./../pages/users-page/users.page').then(m => m.UsersPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/usuário listar', 
      types: [Professionals.ADMINISTRADOR] 
    }
  },
  {
    path: 'regras',
    loadComponent: () => import('./../pages/roles-page/roles.page').then(m => m.RolesPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/regra listar', 
      types: [Professionals.ADMINISTRADOR] 
    }
  },
  {
    path: 'configuracoes',
    loadComponent: () => import('./../pages/settings-page/settings.page').then(m => m.SettingsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/configuração listar', 
      types: [Professionals.ADMINISTRADOR] 
    }
  },
  {
    path: 'pacientes',
    loadComponent: () => import('./../pages/patients-page/patients.page').then(m => m.PatientsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/paciente listar', 
      types: [Professionals.CADASTRO] 
    }
  },
  {
    path: 'arquivo-pacientes',
    loadComponent: () => import('./../pages/archive-patients-page/archive-patients.page').then(m => m.ArchivePatientsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/paciente listar', 
      types: [Professionals.CADASTRO] 
    }
  },
  {
    path: 'solicitacoes',
    loadComponent: () => import('./../pages/patient-requests-page/patient-requests.page').then(m => m.PatientRequestsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/solicitação listar', 
      types: [Professionals.ADMINISTRATIVO, Professionals.CADASTRO] 
    }
  },
  {
    path: 'arquivo-solicitacoes',
    loadComponent: () => import('./../pages/archive-patient-requests-page/archive-patient-requests.page').then(m => m.ArchivePatientRequestsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/solicitação listar', 
      types: [Professionals.CADASTRO] 
    }
  },
  {
    path: 'pareceres-medicos',
    loadComponent: () => import('./../pages/patient-request-medical-opinions-page/patient-request-medical-opinions.page').then(m => m.PatientRequestMedicalOpinionsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/parecer listar', 
      types: [Professionals.MEDICO] // Acesso exclusivo para o tipo Médico
    }
  },
  {
    path: 'arquivo-pareceres-medico',
    loadComponent: () => import('./../pages/archive-patient-request-medical-opinions-page/archive-patient-request-medical-opinions.page').then(m => m.ArchivePatientRequestMedicalOpinionsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/parecer listar', 
      types: [Professionals.MEDICO, Professionals.ASSISTENTE_SOCIAL] 
    }
  },
  {
    path: 'pareceres-sociais',
    loadComponent: () => import('./../pages/patient-request-social-opinions-page/patient-request-social-opinions.page').then(m => m.PatientRequestSocialOpinionsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/parecer listar', 
      types: [Professionals.ASSISTENTE_SOCIAL] // Acesso exclusivo para Assistente Social
    }
  },
  {
    path: 'arquivo-pareceres-social',
    loadComponent: () => import('./../pages/archive-patient-request-social-opinions-page/archive-patient-request-social-opinions.page').then(m => m.ArchivePatientRequestSocialOpinionsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/parecer listar', 
      types: [Professionals.MEDICO, Professionals.ASSISTENTE_SOCIAL] 
    }
  },
  {
    path: 'passagens',
    loadComponent: () => import('./../pages/patient-request-travels-page/patient-request-travels.page').then(m => m.PatientRequestTravelsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/passagem listar', 
      types: [Professionals.PASSAGEM] 
    }
  },
  {
    path: 'arquivo-passagens',
    loadComponent: () => import('./../pages/archive-patient-request-travels-page/archive-patient-request-travels.page').then(m => m.ArchivePatientRequestTravelsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/passagem listar', 
      types: [Professionals.PASSAGEM] 
    }
  },
  {
    path: 'ajudas-de-custo',
    loadComponent: () => import('./../pages/patient-request-cost-assistances-page/patient-request-cost-assistances.page').then(m => m.PatientRequestCostAssistancesPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/ajuda de custo listar', 
      types: [Professionals.AJUDA_DE_CUSTO] 
    }
  },
  {
    path: 'pagamentos',
    loadComponent: () => import('./../pages/payments-page/payments.page').then(m => m.PaymentsPage),
    canActivate: [professionalGuard],
    data: { 
      permission: 'tfd/pagamento listar', 
      types: [Professionals.PAGAMENTO] 
    }
  }
];
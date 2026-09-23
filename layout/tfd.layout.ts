import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild, DestroyRef, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

// Serviços e Componentes
import { LoadingComponent } from '../../core/components/loading-component/loading-component';

// Modais (Dialogs)
import { PatientCreateComponent } from '../components/patients/patient-create/patient-create.component';
import { PatientRequestCreateComponent } from '../components/patient-requests/patient-request-create/patient-request-create.component';
import { PatientRequestTravelsImportComponent } from '../components/patient-request-travels/patient-request-travels-import/patient-request-travels-import.component';
import { UserCreateComponent } from '../components/users/user-create/user-create.component';
import { RoleCreateComponent } from '../components/roles/role-create/role-create.component';

// Enums Locais
import { Professionals } from '../enums/professionals';

// Nomes dos canais do módulo TFD
type TfdChannelKey = 'ROLES' | 'USERS' | 'PATIENTS' | 'REQUESTS' | 'TRAVELS';

const TFD_CHANNEL_NAMES: Record<TfdChannelKey, string> = {
  ROLES: 'tfd-roles-channel',
  USERS: 'tfd-users-channel',
  PATIENTS: 'tfd-patients-channel',
  REQUESTS: 'tfd-patient-requests-channel',
  TRAVELS: 'tfd-travels-channel',
};

interface MenuItem {
  label: string;
  icon: string;
  types?: string[];        // Tipos de profissional autorizados (opcional)
  permissions?: string[];  // Permissões de acesso autorizadas (opcional)
  routerLink?: string[];
  action?: () => void;
}

interface MenuGroup {
  subHeader: string;
  requiredTypes?: string[];       // Tipos exigidos para o grupo
  requiredPermissions?: string[]; // Permissões exigidas para o grupo
  items: MenuItem[];
}

@Component({
  selector: 'app-tfd-layout',
  standalone: true,
  imports: [
    CommonModule, 
    MatSidenavModule, 
    MatListModule, 
    MatIconModule, 
    RouterModule, 
    MatMenuModule,
    MatDialogModule
  ],
  templateUrl: './tfd.layout.html',
  styleUrl: './tfd.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TfdLayout implements OnInit, OnDestroy {
  // 🔒 Injeções de dependência
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  // Captura do input HTML
  protected readonly competence = viewChild.required<ElementRef>('competence');
  
  private loadingDialog!: MatDialogRef<LoadingComponent>;
  private readonly selectedFile = signal<File | null>(null);

  // 📡 Mapa de instâncias dos BroadcastChannels do TFD
  private readonly channels = new Map<TfdChannelKey, BroadcastChannel>();

  // ==========================================
  // Ciclo de Vida (Inicialização e Finalização dos Canais)
  // ==========================================
  ngOnInit(): void {
    // Instancia todos os canais quando o layout é carregado
    (Object.keys(TFD_CHANNEL_NAMES) as TfdChannelKey[]).forEach(key => {
      this.channels.set(key, new BroadcastChannel(TFD_CHANNEL_NAMES[key]));
    });
  }

  ngOnDestroy(): void {
    // Finaliza TODOS os canais de uma vez quando o usuário SAI do TfdLayout
    this.channels.forEach(channel => channel.close());
    this.channels.clear();
  }

  /**
   * Método auxiliar para emitir mensagens com segurança no canal especificado
   */
  public postMessage(channelKey: TfdChannelKey, message: any = 'update'): void {
    const channel = this.channels.get(channelKey);
    if (channel) {
      channel.postMessage(message);
    }
  }

  // ==========================================
  // Métodos de Verificação de Acesso por Professional Types
  // ==========================================

  /**
   * Obtém o objeto `user` da rota atual ou da rota pai.
   */
  private get currentUser(): any {
    return this.route.snapshot.data['user'] || this.route.parent?.snapshot.data['user'];
  }

  /**
   * Extrai a lista de tipos de profissional atrelados ao usuário logado.
   */
  private get userProfessionalTypes(): string[] {
    const user = this.currentUser;
    const professional = user?.professional;

    if (!professional?.types || !Array.isArray(professional.types)) {
      return [];
    }

    return professional.types.map((item: any) => typeof item === 'string' ? item : item.type);
  }

  /**
   * Verifica se o usuário possui ao menos um dos tipos de profissional informados.
   */
  protected checkProfessionalType(allowedTypes?: string[]): boolean {
    if (!allowedTypes || allowedTypes.length === 0) return true;

    const currentTypes = this.userProfessionalTypes;
    return allowedTypes.some(type => currentTypes.includes(type));
  }

  /**
   * Verifica se o usuário possui ao menos uma das permissões informadas.
   */
  protected checkPermission(names?: string[]): boolean {
    if (!names || names.length === 0) return true;

    const user = this.currentUser;
    const roles: any[] = user?.roles || [];

    // Se o usuário não tem roles atreladas, não possui a permissão
    if (!roles.length) return false;

    // Obtém o nome do módulo ativo na rota
    const module = this.route.snapshot.routeConfig?.path || this.route.parent?.snapshot.routeConfig?.path || '';

    // Consolida todas as permissões das roles do usuário
    const userPermissions = roles.flatMap((role: any) => 
      (role.permissions || []).map((p: any) => p.name)
    );

    // Retorna true se houver correspondência com ou sem o prefixo do módulo
    return names.some(name => {
      const fullPermissionName = module ? `${module}/${name}` : name;
      return userPermissions.includes(fullPermissionName) || userPermissions.includes(name);
    });
  }

  /**
   * Combina a verificação de Tipo de Profissional E Permissões (E Lógica).
   */
  protected hasAccess(types?: string[], permissions?: string[]): boolean {
    return this.checkProfessionalType(types) && this.checkPermission(permissions);
  }

  private openDialog(component: any, width = '500px', height = 'auto', channelKey?: TfdChannelKey): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && channelKey) {
          this.postMessage(channelKey, 'update');
        }
      });
  }

  // ==========================================
  // MENU DO TEMPLATE HTML (Baseado em Types)
  // ==========================================
  protected readonly menuGroups: MenuGroup[] = [
    {
      subHeader: 'Usuários',
      requiredTypes: [Professionals.ADMINISTRADOR],
      requiredPermissions: ['usuário listar', 'usuário criar'],
      items: [
        { 
          label: 'Usuários', 
          icon: 'groups', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['usuário listar'], 
          routerLink: ['usuarios'] 
        },
        { 
          label: 'Novo usuário', 
          icon: 'person_add', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['usuário criar'], 
          action: () => this.userCreate() 
        }
      ]
    },
    {
      subHeader: 'Regras',
      requiredTypes: [Professionals.ADMINISTRADOR],
      requiredPermissions: ['regra listar', 'regra criar'],
      items: [
        { 
          label: 'Regras', 
          icon: 'security', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['regra listar'], 
          routerLink: ['regras'] 
        },
        { 
          label: 'Nova regra', 
          icon: 'add_moderator', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['regra criar'], 
          action: () => this.roleCreate() 
        }
      ]
    },
    {
      subHeader: 'Configurações',
      requiredTypes: [Professionals.ADMINISTRADOR],
      requiredPermissions: ['configuração listar'],
      items: [
        { 
          label: 'Configurações', 
          icon: 'settings', 
          types: [Professionals.ADMINISTRADOR], 
          permissions: ['configuração listar'], 
          routerLink: ['configuracoes'] 
        }
      ]
    },
    {
      subHeader: 'Pacientes',
      requiredTypes: [Professionals.CADASTRO],
      requiredPermissions: ['paciente listar', 'paciente criar'],
      items: [
        { 
          label: 'Pacientes', 
          icon: 'personal_injury', 
          types: [Professionals.CADASTRO], 
          permissions: ['paciente listar'], 
          routerLink: ['pacientes'] 
        },
        { 
          label: 'Novo paciente', 
          icon: 'person_add', 
          types: [Professionals.CADASTRO], 
          permissions: ['paciente criar'], 
          action: () => this.patientCreate() 
        },
        { 
          label: 'Arquivo', 
          icon: 'inventory_2', 
          types: [Professionals.CADASTRO], 
          permissions: ['paciente listar'], 
          routerLink: ['arquivo-pacientes'] 
        },
      ]
    },
    {
      subHeader: 'Solicitações',
      requiredTypes: [Professionals.ADMINISTRATIVO, Professionals.CADASTRO],
      requiredPermissions: ['solicitação listar', 'solicitação criar'],
      items: [
        { 
          label: 'Solicitações', 
          icon: 'assignment', 
          types: [Professionals.ADMINISTRATIVO, Professionals.CADASTRO], 
          permissions: ['solicitação listar'], 
          routerLink: ['solicitacoes'] 
        },
        { 
          label: 'Nova solicitação', 
          icon: 'post_add', 
          types: [Professionals.ADMINISTRATIVO, Professionals.CADASTRO], 
          permissions: ['solicitação criar'], 
          action: () => this.patientRequestCreate() 
        },
      ]
    },
    {
      subHeader: 'Pareceres',
      requiredTypes: [Professionals.ASSISTENTE_SOCIAL, Professionals.MEDICO],
      requiredPermissions: ['parecer listar'],
      items: [
        { 
          label: 'Pareceres técnicos', 
          icon: 'description', 
          types: [Professionals.ASSISTENTE_SOCIAL, Professionals.MEDICO], 
          permissions: ['parecer listar'], 
          routerLink: ['pareceres'] 
        },
        { 
          label: 'Arquivo', 
          icon: 'inventory_2', 
          types: [Professionals.ASSISTENTE_SOCIAL, Professionals.MEDICO], 
          permissions: ['parecer listar'], 
          routerLink: ['arquivo-pareceres'] 
        },
      ]
    },
    {
      subHeader: 'Passagens',
      requiredTypes: [Professionals.PASSAGEM],
      requiredPermissions: ['passagem listar', 'passagem criar'],
      items: [
        { 
          label: 'Viagens', 
          icon: 'luggage', 
          types: [Professionals.PASSAGEM], 
          permissions: ['passagem listar'], 
          routerLink: ['passagens'] 
        },
        { 
          label: 'Importar passagens', 
          icon: 'connecting_airports', 
          types: [Professionals.PASSAGEM], 
          permissions: ['passagem criar'], 
          action: () => this.patientRequestTravelsImport() 
        },
        { 
          label: 'Arquivo', 
          icon: 'inventory_2', 
          types: [Professionals.PASSAGEM], 
          permissions: ['passagem listar'], 
          routerLink: ['arquivo-passagens'] 
        },
      ]
    },
    {
      subHeader: 'Ajuda de custo',
      requiredTypes: [Professionals.AJUDA_DE_CUSTO],
      requiredPermissions: ['ajuda de custo listar'],
      items: [
        { 
          label: 'Ajuda de custo', 
          icon: 'price_check', 
          types: [Professionals.AJUDA_DE_CUSTO], 
          permissions: ['ajuda de custo listar'], 
          routerLink: ['ajudas-de-custo'] 
        },
        { 
          label: 'Arquivo', 
          icon: 'inventory_2', 
          types: [Professionals.AJUDA_DE_CUSTO], 
          permissions: ['ajuda de custo listar'], 
          routerLink: ['arquivo-ajudas-de-custo'] 
        },
      ]
    },
    {
      subHeader: 'Prestações de conta',
      requiredTypes: [Professionals.AJUDA_DE_CUSTO],
      requiredPermissions: ['ajuda de custo listar'],
      items: [
        { 
          label: 'Prestação de contas', 
          icon: 'receipt_long', 
          types: [Professionals.AJUDA_DE_CUSTO], 
          permissions: ['ajuda de custo listar'], 
          routerLink: ['prestacoes-de-conta'] 
        },
        { 
          label: 'Arquivo', 
          icon: 'inventory_2', 
          types: [Professionals.AJUDA_DE_CUSTO], 
          permissions: ['ajuda de custo listar'], 
          routerLink: ['arquivo-prestacoes-de-conta'] 
        }
      ]
    },
    {
      subHeader: 'Pagamentos',
      requiredTypes: [Professionals.PAGAMENTO],
      requiredPermissions: ['pagamento listar'],
      items: [
        { 
          label: 'Pagamentos', 
          icon: 'payments', 
          types: [Professionals.PAGAMENTO], 
          permissions: ['pagamento listar'], 
          routerLink: ['pagamentos'] 
        },
        { 
          label: 'Arquivo', 
          icon: 'inventory_2', 
          types: [Professionals.PAGAMENTO], 
          permissions: ['pagamento listar'], 
          routerLink: ['arquivo-pagamentos'] 
        }
      ]
    }
  ];

  // --- MÉTODOS DE AÇÃO DO TEMPLATE HTML ---
  protected userCreate(): void {
    this.openDialog(UserCreateComponent, '700px', 'auto', 'USERS');
  }

  protected roleCreate(): void {
    this.openDialog(RoleCreateComponent, '900px', 'auto', 'ROLES');
  }
        
  protected patientCreate(): void {
    this.openDialog(PatientCreateComponent, '1200px', '700px', 'PATIENTS');
  }

  protected patientRequestCreate(): void {
    this.openDialog(PatientRequestCreateComponent, '800px', 'auto', 'REQUESTS');
  }

  protected patientRequestTravelsImport(): void {
    this.openDialog(PatientRequestTravelsImportComponent, '400px', 'auto', 'TRAVELS');
  }
}
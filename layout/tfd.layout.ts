import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
  DestroyRef,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

// Modais (Dialogs)
import { PatientCreateComponent } from '../components/patients/patient-create/patient-create.component';
import { PatientRequestCreateComponent } from '../components/patient-requests/patient-request-create/patient-request-create.component';
import { PatientRequestTravelsImportComponent } from '../components/patient-request-travels/patient-request-travels-import/patient-request-travels-import.component';
import { UserCreateComponent } from '../components/users/user-create/user-create.component';
import { RoleCreateComponent } from '../components/roles/role-create/role-create.component';

// Enums Locais e Serviços (Padrão alias "as User")
import { Professionals } from '../enums/professionals';
import { TfdUser as User } from '../models/user.model';
import { AuthService } from '../services/auth.service';

// ============================================================================
// CONFIGURAÇÃO DO MÓDULO (Único bloco a ajustar ao replicar para outro módulo)
// ============================================================================
type ChannelKey = 'ROLES' | 'USERS' | 'PATIENTS' | 'REQUESTS' | 'TRAVELS';

const LAYOUT_CONFIG = {
  moduleSlug: 'tfd',
  channels: {
    ROLES: 'tfd-roles-channel',
    USERS: 'tfd-users-channel',
    PATIENTS: 'tfd-patients-channel',
    REQUESTS: 'tfd-patient-requests-channel',
    TRAVELS: 'tfd-travels-channel',
  } satisfies Record<ChannelKey, string>,
} as const;

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
    MatDialogModule,
  ],
  templateUrl: './tfd.layout.html',
  styleUrl: './tfd.layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TfdLayout implements OnInit, OnDestroy {
  // 🔒 Injeções de dependência
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  // Captura opcional do input HTML (evita crash caso não exista no template)
  protected readonly competence = viewChild<ElementRef>('competence');

  // 📡 Mapa de instâncias dos BroadcastChannels do módulo
  private readonly channels = new Map<ChannelKey, BroadcastChannel>();

  // ==========================================
  // REATIVIDADE VIA SIGNALS
  // ==========================================

  /**
   * 1. Reage dinamicamente a alterações no usuário logado dentro do AuthService
   */
  protected readonly currentUser = computed(() => this.authService.currentUser() as User | null);

  /**
   * 2. Extrai os tipos de profissional normalizados em lowercase
   */
  protected readonly userProfessionalTypes = computed<string[]>(() => {
    const professional = this.currentUser()?.professional as Record<string, unknown> | undefined;
    if (!professional) return [];

    const rawTypes = professional['types'] ?? professional['type'] ?? [];
    const typesList = Array.isArray(rawTypes) ? rawTypes : [rawTypes];

    return typesList
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          return (obj['type'] ?? obj['name'] ?? obj['description'] ?? '') as string;
        }
        return '';
      })
      .map((type) => type.trim().toLowerCase())
      .filter(Boolean);
  });

  /**
   * 3. Extrai e memoriza as permissões do usuário em um Set (O(1) nas consultas do menu)
   */
  protected readonly userPermissions = computed<Set<string>>(() => {
    const roles = this.currentUser()?.roles || [];
    return new Set<string>(
      roles
        .flatMap((role) => role.permissions || [])
        .map((p) => p.name?.trim().toLowerCase())
        .filter((name): name is string => Boolean(name))
    );
  });

  /**
   * 4. Filtra automaticamente grupos e itens autorizados (pode ser usado direto no @for do HTML)
   */
  protected readonly visibleMenuGroups = computed<MenuGroup[]>(() => {
    // Lê os signals para registrar dependência reativa
    this.userProfessionalTypes();
    this.userPermissions();

    return this.menuGroups
      .filter((group) => this.hasAccess(group.requiredTypes, group.requiredPermissions))
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => this.hasAccess(item.types, item.permissions)),
      }))
      .filter((group) => group.items.length > 0);
  });

  // ==========================================
  // Ciclo de Vida (BroadcastChannels)
  // ==========================================

  ngOnInit(): void {
    (Object.keys(LAYOUT_CONFIG.channels) as ChannelKey[]).forEach((key) => {
      this.channels.set(key, new BroadcastChannel(LAYOUT_CONFIG.channels[key]));
    });
  }

  ngOnDestroy(): void {
    this.channels.forEach((channel) => channel.close());
    this.channels.clear();
  }

  public postMessage(channelKey: ChannelKey, message: unknown = 'update'): void {
    const channel = this.channels.get(channelKey);
    if (channel) {
      channel.postMessage(message);
    }
  }

  // ==========================================
  // Métodos de Verificação de Acesso
  // ==========================================

  protected checkProfessionalType(allowedTypes?: string[]): boolean {
    if (!allowedTypes || allowedTypes.length === 0) return true;

    const currentTypes = this.userProfessionalTypes();
    return allowedTypes.some((type) => currentTypes.includes(type.trim().toLowerCase()));
  }

  protected checkPermission(names?: string[]): boolean {
    if (!names || names.length === 0) return true;

    const permissions = this.userPermissions();
    if (permissions.size === 0) return false;

    const modulePrefix =
      this.route.snapshot.routeConfig?.path ||
      this.route.parent?.snapshot.routeConfig?.path ||
      LAYOUT_CONFIG.moduleSlug;

    return names.some((name) => {
      const target = name.trim().toLowerCase();
      return permissions.has(`${modulePrefix}/${target}`) || permissions.has(target);
    });
  }

  protected hasAccess(types?: string[], permissions?: string[]): boolean {
    return this.checkProfessionalType(types) && this.checkPermission(permissions);
  }

  private openDialog(component: any, width = '500px', height = 'auto', channelKey?: ChannelKey): void {
    this.dialog
      .open(component, {
        width,
        height,
        disableClose: true,
        autoFocus: false,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && channelKey) {
          this.postMessage(channelKey, 'update');
        }
      });
  }

  // ==========================================
  // MENU DO TEMPLATE HTML
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
          routerLink: ['usuarios'],
        },
        {
          label: 'Novo usuário',
          icon: 'person_add',
          types: [Professionals.ADMINISTRADOR],
          permissions: ['usuário criar'],
          action: () => this.userCreate(),
        },
      ],
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
          routerLink: ['regras'],
        },
        {
          label: 'Nova regra',
          icon: 'add_moderator',
          types: [Professionals.ADMINISTRADOR],
          permissions: ['regra criar'],
          action: () => this.roleCreate(),
        },
      ],
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
          routerLink: ['configuracoes'],
        },
      ],
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
          routerLink: ['pacientes'],
        },
        {
          label: 'Novo paciente',
          icon: 'person_add',
          types: [Professionals.CADASTRO],
          permissions: ['paciente criar'],
          action: () => this.patientCreate(),
        },
        {
          label: 'Arquivo',
          icon: 'inventory_2',
          types: [Professionals.CADASTRO],
          permissions: ['paciente listar'],
          routerLink: ['arquivo-pacientes'],
        },
      ],
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
          routerLink: ['solicitacoes'],
        },
        {
          label: 'Nova solicitação',
          icon: 'post_add',
          types: [Professionals.ADMINISTRATIVO, Professionals.CADASTRO],
          permissions: ['solicitação criar'],
          action: () => this.patientRequestCreate(),
        },
        {
          label: 'Arquivo',
          icon: 'inventory_2',
          types: [Professionals.ADMINISTRATIVO, Professionals.CADASTRO],
          permissions: ['solicitação listar'],
          routerLink: ['arquivo-solicitacoes'],
        },
      ],
    },
    {
      subHeader: 'Pareceres Médicos',
      requiredTypes: [Professionals.MEDICO],
      requiredPermissions: ['parecer listar'],
      items: [
        {
          label: 'Pareceres médicos',
          icon: 'description',
          types: [Professionals.MEDICO],
          permissions: ['parecer listar'],
          routerLink: ['pareceres-medicos'],
        },
        {
          label: 'Arquivo',
          icon: 'inventory_2',
          types: [Professionals.MEDICO],
          permissions: ['parecer listar'],
          routerLink: ['arquivo-pareceres-medico'],
        },
      ],
    },
    {
      subHeader: 'Pareceres Sociais',
      requiredTypes: [Professionals.ASSISTENTE_SOCIAL],
      requiredPermissions: ['parecer listar'],
      items: [
        {
          label: 'Pareceres sociais',
          icon: 'description',
          types: [Professionals.ASSISTENTE_SOCIAL],
          permissions: ['parecer listar'],
          routerLink: ['pareceres-sociais'],
        },
        {
          label: 'Arquivo',
          icon: 'inventory_2',
          types: [Professionals.ASSISTENTE_SOCIAL],
          permissions: ['parecer listar'],
          routerLink: ['arquivo-pareceres-social'],
        },
      ],
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
          routerLink: ['passagens'],
        },
        {
          label: 'Importar passagens',
          icon: 'connecting_airports',
          types: [Professionals.PASSAGEM],
          permissions: ['passagem criar'],
          action: () => this.patientRequestTravelsImport(),
        },
        {
          label: 'Arquivo',
          icon: 'inventory_2',
          types: [Professionals.PASSAGEM],
          permissions: ['passagem listar'],
          routerLink: ['arquivo-passagens'],
        },
      ],
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
          routerLink: ['ajudas-de-custo'],
        },
        {
          label: 'Arquivo',
          icon: 'inventory_2',
          types: [Professionals.AJUDA_DE_CUSTO],
          permissions: ['ajuda de custo listar'],
          routerLink: ['arquivo-ajudas-de-custo'],
        },
      ],
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
          routerLink: ['prestacao-de-contas'],
        },
        {
          label: 'Arquivo',
          icon: 'inventory_2',
          types: [Professionals.AJUDA_DE_CUSTO],
          permissions: ['ajuda de custo listar'],
          routerLink: ['arquivo-prestacao-de-contas'],
        },
      ],
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
          routerLink: ['pagamentos'],
        },
        {
          label: 'Arquivo',
          icon: 'inventory_2',
          types: [Professionals.PAGAMENTO],
          permissions: ['pagamento listar'],
          routerLink: ['arquivo-pagamentos'],
        },
      ],
    },
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
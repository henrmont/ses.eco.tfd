import { ChangeDetectionStrategy, Component, ElementRef, inject, viewChild, DestroyRef, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

// Serviços e Componentes
import { MessageService } from '../../../core/services/message-service';
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { DatasusService } from '../../services/datasus-service';

// Modais (Dialogs)
import { PatientCreateComponent } from '../../components/patients/patient-create/patient-create.component';
import { PatientRequestCreateComponent } from '../../components/patient-requests/patient-request-create/patient-request-create.component';
import { PatientRequestTravelsImportComponent } from '../../components/patient-request-travels/patient-request-travels-import/patient-request-travels-import.component';
import { UserCreateComponent } from '../../components/users/user-create/user-create.component';
import { RoleCreateComponent } from '../../components/roles/role-create/role-create.component';

// Nomes dos canais do módulo TFD
type TfdChannelKey = 'ROLES' | 'USERS' | 'HOSPITALS' | 'SIGTAP' | 'PATIENTS' | 'REQUESTS' | 'TRAVELS';

const TFD_CHANNEL_NAMES: Record<TfdChannelKey, string> = {
  ROLES: 'tfd-roles-channel',
  USERS: 'tfd-users-channel',
  HOSPITALS: 'tfd-hospital-unities-channel',
  SIGTAP: 'tfd-sigtap-channel',
  PATIENTS: 'tfd-patients-channel',
  REQUESTS: 'tfd-patient-requests-channel',
  TRAVELS: 'tfd-travels-channel',
};

interface MenuItem {
  label: string;
  icon: string;
  permissions: string[];
  routerLink?: string[];
  action?: () => void;
}

interface MenuGroup {
  subHeader: string;
  requiredRoles: string[];
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
  private readonly messageService = inject(MessageService);
  private readonly datasusService = inject(DatasusService);
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
  // Métodos do Template
  // ==========================================
  protected checkPermission(names: string[]): boolean {
    const module = this.route.snapshot.routeConfig?.path;
    const roles = this.route.parent?.snapshot.data['user']?.roles || [];
    
    return roles.some((role: any) => {
      const permissions: string[] = role.permissions?.map((p: any) => p.name) || [];
      return names.some(name => permissions.includes(`${module}/${name}`));
    });
  }

  protected importCompetence(): void {
    this.competence().nativeElement.click();
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (files && files.length > 0 && files[0].type === 'application/zip') {
      this.openLoading();
      this.selectedFile.set(files[0]);
      
      this.datasusService.process(this.selectedFile()!)
        .pipe(
          finalize(() => {
            if (this.loadingDialog) this.loadingDialog.close();
            input.value = '';
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (response) => {
            this.messageService.showMessage(response.message);
            this.postMessage('SIGTAP', 'update');
          },
          error: (error) => {
            const fallbackError = error?.error?.message || 'Erro ao processar arquivo';
            this.messageService.showMessage(fallbackError);
          },
        });
    } else {
      input.value = '';
    }
  }

  private openLoading(): void {
    this.loadingDialog = this.dialog.open(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
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

  // --- MENU DO TEMPLATE HTML ---
  protected readonly menuGroups: MenuGroup[] = [
    {
      subHeader: 'Usuários',
      requiredRoles: ['usuário listar', 'usuário criar'],
      items: [
        { label: 'Usuários', icon: 'groups', permissions: ['usuário listar'], routerLink: ['usuarios'] },
        { label: 'Novo usuário', icon: 'person_add', permissions: ['usuário criar'], action: () => this.userCreate() }
      ]
    },
    {
      subHeader: 'Regras',
      requiredRoles: ['regra listar', 'regra criar'],
      items: [
        { label: 'Regras', icon: 'security', permissions: ['regra listar'], routerLink: ['regras'] },
        { label: 'Nova regra', icon: 'add_moderator', permissions: ['regra criar'], action: () => this.roleCreate() }
      ]
    },
    {
      subHeader: 'Datasus',
      requiredRoles: ['datasus listar', 'datasus importar'],
      items: [
        { label: 'Sigtap', icon: 'medical_services', permissions: ['datasus listar'], routerLink: ['sigtap'] },
        { label: 'Importar competência', icon: 'upload', permissions: ['datasus importar'], action: () => this.importCompetence() }
      ]
    },
    {
      subHeader: 'Configurações',
      requiredRoles: ['configuração listar'],
      items: [
        { label: 'Configurações', icon: 'settings', permissions: ['configuração listar'], routerLink: ['configuracoes'] }
      ]
    },
    {
      subHeader: 'Pacientes',
      requiredRoles: ['paciente listar', 'paciente criar'],
      items: [
        { label: 'Pacientes', icon: 'personal_injury', permissions: ['paciente listar'], routerLink: ['pacientes'] },
        { label: 'Novo paciente', icon: 'person_add', permissions: ['paciente criar'], action: () => this.patientCreate() },
        { label: 'Arquivo', icon: 'inventory_2', permissions: ['paciente listar'], routerLink: ['arquivo-pacientes'] },
      ]
    },
    {
      subHeader: 'Solicitações',
      requiredRoles: ['solicitação listar', 'solicitação criar'],
      items: [
        { label: 'Solicitações', icon: 'assignment', permissions: ['solicitação listar'], routerLink: ['solicitacoes'] },
        { label: 'Nova solicitação', icon: 'post_add', permissions: ['solicitação criar'], action: () => this.patientRequestCreate() },
      ]
    },
    {
      subHeader: 'Pareceres',
      requiredRoles: ['parecer listar'],
      items: [
        { label: 'Pareceres técnicos', icon: 'description', permissions: ['parecer listar'], routerLink: ['pareceres'] },
        { label: 'Arquivo', icon: 'inventory_2', permissions: ['parecer listar'], routerLink: ['arquivo-pareceres'] },
      ]
    },
    {
      subHeader: 'Passagens',
      requiredRoles: ['passagem listar', 'passagem criar'],
      items: [
        { label: 'Viagens', icon: 'luggage', permissions: ['passagem listar'], routerLink: ['passagens'] },
        { label: 'Importar passagens', icon: 'connecting_airports', permissions: ['passagem criar'], action: () => this.patientRequestTravelsImport() },
        { label: 'Arquivo', icon: 'inventory_2', permissions: ['passagem listar'], routerLink: ['arquivo-passagens'] },
      ]
    },
    {
      subHeader: 'Ajuda de custo',
      requiredRoles: ['ajuda de custo listar'],
      items: [
        { label: 'Ajuda de custo', icon: 'price_check', permissions: ['ajuda de custo listar'], routerLink: ['ajudas-de-custo'] },
        { label: 'Arquivo', icon: 'inventory_2', permissions: ['ajuda de custo listar'], routerLink: ['arquivo-ajudas-de-custo'] },
      ]
    },
    {
      subHeader: 'Prestações de conta',
      requiredRoles: ['ajuda de custo listar'],
      items: [
        { label: 'Prestação de contas', icon: 'receipt_long', permissions: ['ajuda de custo listar'], routerLink: ['prestacoes-de-conta'] },
        { label: 'Arquivo', icon: 'inventory_2', permissions: ['ajuda de custo listar'], routerLink: ['arquivo-prestacoes-de-conta'] }
      ]
    },
    {
      subHeader: 'Pagamentos',
      requiredRoles: ['pagamento listar'],
      items: [
        { label: 'Pagamentos', icon: 'payments', permissions: ['pagamento listar'], routerLink: ['pagamentos'] },
        { label: 'Arquivo', icon: 'inventory_2', permissions: ['pagamento listar'], routerLink: ['arquivo-pagamentos'] }
      ]
    },
    {
      subHeader: 'Consultar',
      requiredRoles: ['consultar paciente', 'consultar arquivo'],
      items: [
        { label: 'Paciente', icon: 'person_search', permissions: ['consultar paciente'], routerLink: ['consultar-paciente'] },
        { label: 'Arquivo', icon: 'inventory_2', permissions: ['consultar arquivo'], routerLink: ['consultar-arquivo'] }
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
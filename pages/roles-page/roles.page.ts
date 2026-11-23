import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { finalize } from 'rxjs';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models (Padrão alias "as User")
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { Permission } from '../../../core/models/permission.model';
import { Role } from '../../../core/models/role.model';
import { TfdUser as User } from '../../models/user.model';
import { RoleService } from '../../services/role.service';
import { AuthService } from '../../services/auth.service';

// Dialog Components
import { RoleDeleteComponent } from '../../components/roles/role-delete/role-delete.component';
import { RoleUpdateComponent } from '../../components/roles/role-update/role-update.component';

// ============================================================================
// CONFIGURAÇÃO DO MÓDULO (Único bloco a ajustar ao replicar para outro módulo)
// ============================================================================
const PAGE_CONFIG = {
  channelName: 'tfd-roles-channel',
  permissionPrefix: 'tfd/',
} as const;

interface RolesDialogData {
  role: Role;
}

@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './roles.page.html',
  styleUrl: './roles.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly rolesChannel = new BroadcastChannel(PAGE_CONFIG.channelName);

  // Injeção de Dependências
  private readonly roleService = inject(RoleService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // Queries Reativas da View
  private readonly roleSort = viewChild<MatSort>('roleSort');
  private readonly rolePaginator = viewChild<MatPaginator>('rolePaginator');

  // Estado e Controle Reativo
  private loadingDialog?: MatDialogRef<LoadingComponent>;
  private readonly currentUser = computed(() => this.authService.currentUser() as User | null);

  private readonly userPermissions = computed<Set<string>>(() => {
    const roles = this.currentUser()?.roles || [];
    return new Set<string>(
      roles
        .flatMap((role: Role) => role.permissions || [])
        .map((perm: Permission) => perm.name?.trim().toLowerCase())
        .filter((name): name is string => Boolean(name))
    );
  });

  private readonly ownerRoleNames = computed<Set<string>>(() => {
    const roles = this.currentUser()?.roles || [];
    return new Set<string>(
      roles
        .map((role: Role) => role.name?.trim().toLowerCase())
        .filter((name): name is string => Boolean(name))
    );
  });

  protected readonly displayedColumns: string[] = ['name', 'actions'];
  protected readonly dataSource = new MatTableDataSource<Role>([]);

  constructor() {
    effect(() => {
      const sort = this.roleSort();
      const paginator = this.rolePaginator();

      if (sort) this.dataSource.sort = sort;
      if (paginator) this.dataSource.paginator = paginator;
    });
  }

  ngOnInit(): void {
    this.fetchRoles(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.rolesChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis no Template
  // ==========================================
  protected applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Retorna `true` quando o botão deve ficar DESABILITADO (`[disabled]="checkPermissions('...')"`)
   */
  protected checkPermissions(permissionName: string): boolean {
    const permissions = this.userPermissions();
    if (permissions.size === 0) return true;

    const target = permissionName.trim().toLowerCase();
    const hasPermission =
      permissions.has(target) ||
      permissions.has(`${PAGE_CONFIG.permissionPrefix}${target}`);

    return !hasPermission;
  }

  /**
   * Retorna `true` se o usuário logado possui esta regra atribuída (evita autoedição/exclusão)
   */
  protected ownerRole(role: Role): boolean {
    const roleName = role.name?.trim().toLowerCase();
    if (!roleName) return false;
    return this.ownerRoleNames().has(roleName);
  }

  // Ações da Tabela
  protected roleUpdate(role: Role): void {
    this.openDialog(RoleUpdateComponent, { role }, '900px');
  }

  protected roleDelete(role: Role): void {
    this.openDialog(RoleDeleteComponent, { role });
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private fetchRoles(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.roleService
      .getRoles()
      .pipe(
        finalize(() => {
          if (showLoading && this.loadingDialog) {
            this.loadingDialog.close();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.dataSource.data = response || [];
        },
        error: () => {
          this.dataSource.data = [];
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.rolesChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchRoles(false);
      }
    };
  }

  private openLoading(): void {
    this.loadingDialog = this.dialog.open(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: RolesDialogData,
    width = '400px',
    height = 'auto',
    requiresRefresh = true
  ): void {
    this.dialog
      .open(component, {
        width,
        height,
        disableClose: true,
        autoFocus: false,
        scrollStrategy: this.overlay.scrollStrategies.noop(),
        data,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && requiresRefresh) {
          this.handleRoleChange();
        }
      });
  }

  private handleRoleChange(): void {
    this.fetchRoles(false);
    this.rolesChannel.postMessage('update');
  }
}
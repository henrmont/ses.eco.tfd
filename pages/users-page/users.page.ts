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
import { NgxMaskPipe, provideNgxMask } from 'ngx-mask';

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
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

// Dialog Components
import { UserDeleteComponent } from '../../components/users/user-delete/user-delete.component';
import { UserDetailComponent } from '../../components/users/user-detail/user-detail.component';
import { UserLockComponent } from '../../components/users/user-lock/user-lock.component';
import { UserRolesComponent } from '../../components/users/user-roles/user-roles.component';
import { UserUpdateComponent } from '../../components/users/user-update/user-update.component';
import { UserValidateComponent } from '../../components/users/user-validate/user-validate.component';

// ============================================================================
// CONFIGURAÇÃO DO MÓDULO (Único bloco a ajustar ao replicar para outro módulo)
// ============================================================================
const PAGE_CONFIG = {
  channelName: 'tfd-users-channel',
  permissionPrefix: 'tfd/',
} as const;

interface UserTableRow extends User {
  is_editable: boolean;
  cns: string;
}

interface UsersDialogData {
  user: User;
}

@Component({
  selector: 'app-users-page',
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
    NgxMaskPipe,
  ],
  providers: [provideNgxMask()],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly usersChannel = new BroadcastChannel(PAGE_CONFIG.channelName);

  // Injeção de Dependências
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // Queries Reativas da View
  private readonly userSort = viewChild<MatSort>('userSort');
  private readonly userPaginator = viewChild<MatPaginator>('userPaginator');

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

  protected readonly displayedColumns: string[] = [
    'is_editable',
    'email',
    'name',
    'cns',
    'is_valid',
    'actions',
  ];

  protected readonly dataSource = new MatTableDataSource<UserTableRow>([]);

  constructor() {
    effect(() => {
      const sort = this.userSort();
      const paginator = this.userPaginator();

      if (sort) this.dataSource.sort = sort;
      if (paginator) this.dataSource.paginator = paginator;
    });
  }

  ngOnInit(): void {
    this.fetchUsers(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.usersChannel.close();
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

  // Ações da Tabela
  protected userLock(user: User): void {
    this.openDialog(UserLockComponent, { user });
  }

  protected userValidate(user: User): void {
    this.openDialog(UserValidateComponent, { user });
  }

  protected userRoles(user: User): void {
    this.openDialog(UserRolesComponent, { user }, '700px');
  }

  protected userDelete(user: User): void {
    this.openDialog(UserDeleteComponent, { user });
  }

  protected userUpdate(user: User): void {
    this.openDialog(UserUpdateComponent, { user }, '700px');
  }

  protected userDetail(user: User): void {
    this.openDialog(UserDetailComponent, { user }, '700px');
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private fetchUsers(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.userService
      .getUsers()
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
          const rawData = response || [];
          this.dataSource.data = rawData.map((item) => this.mapUserToRow(item));
        },
        error: () => {
          this.dataSource.data = [];
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.usersChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchUsers(false);
      }
    };
  }

  private mapUserToRow(
    item: Partial<User> & { professional?: { name?: string; cns?: string } }
  ): UserTableRow {
    const userObj: User = {
      id: item.id!,
      email: item.email || '',
      name: item.professional?.name || item.name || '',
      module: item.module,
      professional: item.professional,
      roles: item.roles,
    };

    return {
      ...userObj,
      cns: item.professional?.cns || '-',
      is_editable: this.calculateEditable(userObj),
    };
  }

  private calculateEditable(user: User): boolean {
    const loggedUser = this.currentUser();
    if (!loggedUser || loggedUser.id === user.id) return false;
    return !user.module?.pivot?.is_editable;
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
    data: UsersDialogData,
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
          this.handleUserChange();
        }
      });
  }

  private handleUserChange(): void {
    this.fetchUsers(false);
    this.usersChannel.postMessage('update');
  }
}
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnDestroy, OnInit, effect, inject, viewChild } from '@angular/core';
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

// Core & Models
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { Permission } from '../../../core/models/permission.model';
import { Role } from '../../../core/models/role.model';
import { TfdUser } from '../../models/user.model';
import { UserService } from '../../services/user.service';

// Dialog Components
import { UserDeleteComponent } from '../../components/users/user-delete/user-delete.component';
import { UserDetailComponent } from '../../components/users/user-detail/user-detail.component';
import { UserLockComponent } from '../../components/users/user-lock/user-lock.component';
import { UserRolesComponent } from '../../components/users/user-roles/user-roles.component';
import { UserUpdateComponent } from '../../components/users/user-update/user-update.component';
import { UserValidateComponent } from '../../components/users/user-validate/user-validate.component';
import { AuthService } from '../../services/auth.service';

interface UserTableRow extends TfdUser {
  is_editable: boolean;
  cns: string;
}

interface UsersDialogData {
  user: TfdUser;
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
    NgxMaskPipe
  ],
  providers: [provideNgxMask()],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersPage implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly usersChannel = new BroadcastChannel('tfd-users-channel');

  // Injeção de Dependências
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // Queries Reativas da View
  private readonly userSort = viewChild<MatSort>('userSort');
  private readonly userPaginator = viewChild<MatPaginator>('userPaginator');

  // Estado e Controle
  private loadingDialog?: MatDialogRef<LoadingComponent>;
  private readonly currentUser: TfdUser | null = this.authService.getCurrentUser();

  protected readonly displayedColumns: string[] = [
    'is_editable',
    'email',
    'name',
    'cns',
    'is_valid',
    'actions'
  ];

  protected readonly dataSource = new MatTableDataSource<UserTableRow>([]);

  ngOnInit(): void {
    this.setupTableBindings();
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

  protected checkPermissions(permissionName: string): boolean {
    if (!this.currentUser?.roles) return true;

    const hasPermission = this.currentUser.roles.some((role: Role) =>
      role.permissions?.some((perm: Permission) => perm.name === permissionName)
    );

    return !hasPermission;
  }

  // Ações da Tabela
  protected userLock(user: TfdUser): void {
    this.openDialog(UserLockComponent, { user });
  }

  protected userValidate(user: TfdUser): void {
    this.openDialog(UserValidateComponent, { user });
  }

  protected userRoles(user: TfdUser): void {
    this.openDialog(UserRolesComponent, { user }, '700px');
  }

  protected userDelete(user: TfdUser): void {
    this.openDialog(UserDeleteComponent, { user });
  }

  protected userUpdate(user: TfdUser): void {
    this.openDialog(UserUpdateComponent, { user }, '700px');
  }

  protected userDetail(user: TfdUser): void {
    this.openDialog(UserDetailComponent, { user }, '700px');
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private setupTableBindings(): void {
    // Registra o efeito no ciclo de inicialização (ngOnInit) usando o DestroyRef da classe
    effect(() => {
      const sort = this.userSort();
      const paginator = this.userPaginator();

      if (sort) this.dataSource.sort = sort;
      if (paginator) this.dataSource.paginator = paginator;
    }, { injector: this.injector });
  }

  private fetchUsers(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.userService.getUsers()
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
        }
      });
  }

  private listenToBroadcastChannel(): void {
    this.usersChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchUsers(false);
      }
    };
  }

  private mapUserToRow(item: Partial<TfdUser> & { professional?: { name?: string; cns?: string } }): UserTableRow {
    const userObj: TfdUser = {
      id: item.id!,
      email: item.email || '',
      name: item.professional?.name || item.name || '',
      module: item.module,
      professional: item.professional,
      roles: item.roles
    };

    return {
      ...userObj,
      cns: item.professional?.cns || '-',
      is_editable: this.calculateEditable(userObj)
    };
  }

  private calculateEditable(user: TfdUser): boolean {
    if (!this.currentUser || this.currentUser.id === user.id) return false;
    return !user.module?.pivot?.is_editable;
  }

  private openLoading(): void {
    this.loadingDialog = this.dialog.open(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: UsersDialogData,
    width = '400px',
    height = 'auto',
    requiresRefresh = true
  ): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      data
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
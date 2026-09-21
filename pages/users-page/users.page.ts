import { ChangeDetectionStrategy, Component, DestroyRef, Injector, inject, OnDestroy, OnInit, viewChild, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
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
import { Permission } from '../../models/permission.model';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';

// Dialog Components
import { UserDeleteComponent } from '../../components/users/user-delete/user-delete.component';
import { UserDetailComponent } from '../../components/users/user-detail/user-detail.component';
import { UserLockComponent } from '../../components/users/user-lock/user-lock.component';
import { UserRolesComponent } from '../../components/users/user-roles/user-roles.component';
import { UserUpdateComponent } from '../../components/users/user-update/user-update.component';
import { UserValidateComponent } from '../../components/users/user-validate/user-validate.component';

interface UserTableRow extends User {
  is_editable: boolean;
  type: string;
}

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatSortModule, MatTableModule, MatTooltipModule],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersPage implements OnInit, OnDestroy {
  // ==========================================
  // Instância própria do canal
  // ==========================================
  private readonly usersChannel = new BroadcastChannel('tfd-users-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // ViewChildren / Elementos da View
  // ==========================================
  private readonly userSort = viewChild<MatSort>('userSort');
  private readonly userPaginator = viewChild<MatPaginator>('userPaginator');

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  private loadingDialog!: MatDialogRef<LoadingComponent>;
  private readonly currentUser: User | undefined = this.route.parent?.parent?.snapshot.data['user'];

  protected readonly displayedColumns: string[] = [
    'is_editable', 
    'email', 
    'name', 
    'type', 
    'is_valid', 
    'actions'
  ];

  protected readonly dataSource = new MatTableDataSource<UserTableRow>([]);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchUsers(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.usersChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
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

    const hasPermission = this.currentUser.roles.some((role: any) =>
      role.permissions?.some((perm: Permission) => perm.name === permissionName)
    );

    return !hasPermission;
  }

  // Ações disparadas pelos botões da tabela
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
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
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
          this.dataSource.data = rawData.map(item => this.mapUserToRow(item));
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

  private mapUserToRow(item: any): UserTableRow {
    const userObj: User = {
      id: item.id,
      email: item.email,
      name: item.professional?.name || item.name,
      module: item.module,
      professional: item.professional,
      roles: item.roles
    };
    
    return {
      ...userObj,
      type: item.professional?.type || 'Não alocado',
      is_editable: this.calculateEditable(userObj)
    };
  }

  private calculateEditable(user: User): boolean {
    if (!this.currentUser || this.currentUser.id === user.id) return false;
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
    component: new (...args: any[]) => T, 
    data: { user: User }, 
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
    .subscribe(result => {
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
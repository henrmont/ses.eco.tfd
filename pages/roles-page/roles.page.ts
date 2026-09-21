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
import { Role } from '../../models/role.model';
import { User } from '../../models/user.model';
import { RoleService } from '../../services/role.service';

// Dialog Components
import { RoleDeleteComponent } from '../../components/roles/role-delete/role-delete.component';
import { RoleUpdateComponent } from '../../components/roles/role-update/role-update.component';


@Component({
  selector: 'app-roles-page',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule, MatSortModule, MatTableModule, MatTooltipModule],
  templateUrl: './roles.page.html',
  styleUrl: './roles.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RolesPage implements OnInit, OnDestroy {
  // Instância própria da página
  private readonly rolesChannel = new BroadcastChannel('tfd-roles-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly roleService = inject(RoleService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // ViewChildren / Elementos da View
  // ==========================================
  private readonly roleSort = viewChild<MatSort>('roleSort');
  private readonly rolePaginator = viewChild<MatPaginator>('rolePaginator');

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  private loadingDialog!: MatDialogRef<LoadingComponent>;
  private readonly currentUser: User | undefined = this.route.parent?.parent?.snapshot.data['user'];

  protected readonly displayedColumns: string[] = ['name', 'actions'];

  protected readonly dataSource = new MatTableDataSource<Role>([]);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchRoles(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.rolesChannel.close();
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

    const hasPermission = this.currentUser.roles.some((role: Role) =>
      role.permissions?.some((perm: Permission) => perm.name === permissionName)
    );

    return !hasPermission;
  }

  protected ownerRole(role: Role): boolean {
    if (!this.currentUser?.roles) return false;
    const ownerRoleNames = this.currentUser.roles.map((item: Role) => item.name);
    return ownerRoleNames.includes(role.name);
  }

  // Ações disparadas pelos botões da tabela
  protected roleUpdate(role: Role): void { 
    this.openDialog(RoleUpdateComponent, { role }, '900px'); 
  }

  protected roleDelete(role: Role): void { 
    this.openDialog(RoleDeleteComponent, { role }); 
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(() => {
      const sort = this.roleSort();
      const paginator = this.rolePaginator();

      if (sort) this.dataSource.sort = sort;
      if (paginator) this.dataSource.paginator = paginator;
    }, { injector: this.injector });
  }

  private fetchRoles(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.roleService.getRoles()
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
        }
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
    component: new (...args: any[]) => T, 
    data: { role: Role }, 
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
        this.handleRoleChange();
      }
    });
  }

  private handleRoleChange(): void {
    this.fetchRoles(false);
    this.rolesChannel.postMessage('update');
  }
}
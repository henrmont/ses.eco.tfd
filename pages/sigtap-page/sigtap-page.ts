import { Component, OnInit, signal } from '@angular/core';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { Permission } from '../../models/permission.model';
import { DatasusService } from '../../services/datasus-service';

const TFD_SIGTAP_CHANNEL = new BroadcastChannel('tfd-sigtap-channel');

@Component({
  selector: 'app-sigtap-page',
  imports: [MatFormFieldModule, MatInputModule, MatTableModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './sigtap-page.html',
  styleUrl: './sigtap-page.scss',
})
export class SigtapPage implements OnInit {

  displayedColumns: string[] = ['competence','actions'];
  dataSource = signal<MatTableDataSource<any>>(new MatTableDataSource());
  applyFilter(event: Event) {
    const FILTER_VALUE = (event.target as HTMLInputElement).value;
    this.dataSource().filter = FILTER_VALUE.trim().toLowerCase();
  }

  constructor(
    private datasusService: DatasusService,
    private dialog: MatDialog,
    private route: ActivatedRoute
  ) {
    TFD_SIGTAP_CHANNEL.onmessage = (message) => {
      if (message.data == 'update') {
        this.upgradeCompetences()
      }
    }
  }

  ngOnInit(): void {
    this.getCompetences()
  }

  getCompetences() {
    this.loading()
    this.datasusService.getCompetences().subscribe({
      next: (response) => {
        this.dataSource.set(new MatTableDataSource(response))
      },
      complete: () => {
        this.loadingDialog.close()
      }
    })
  }

  upgradeCompetences() {
    this.datasusService.getCompetences().subscribe({
      next: (response) => {
        this.dataSource.set(new MatTableDataSource(response))
      },
    })
  }

  loadingDialog!: MatDialogRef<LoadingComponent>
  loading() {
    this.loadingDialog = this.dialog.open(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
  }

  checkPermissions(name: string) {
    const ROLES = this.route.parent?.parent?.snapshot.data['user'].roles
    for (const item of ROLES) {
      if (item.permissions.filter((permission: Permission) => permission.name == name).length > 0)
        return false 
    }
    return true
  }

}

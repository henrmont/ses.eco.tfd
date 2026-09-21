import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatDatepickerModule} from '@angular/material/datepicker';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';
import { MessageService } from '../../../../core/services/message-service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-patient-request-travels-import',
  imports: [FormsModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatProgressSpinnerModule],
  templateUrl: './patient-request-travels-import.component.html',
  styleUrl: './patient-request-travels-import.component.scss',
})
export class PatientRequestTravelsImportComponent {

  data = inject(MAT_DIALOG_DATA)
  importTicketForm: FormGroup

  constructor(
    private formBuilder: FormBuilder,
    private travelService: PatientRequestTravelService,
    private messageService: MessageService,
    private dialogRef: MatDialogRef<PatientRequestTravelsImportComponent>,
  ) {
    this.importTicketForm = this.formBuilder.group({
      import_at: [null, [Validators.required]],
    });
  }

  wSubmit = signal<boolean>(false)
  onImportTicketSubmit() {
    this.wSubmit.set(true);
    this.travelService.importTravels(this.importTicketForm.value).subscribe({
      next: (response: any) => {
        this.messageService.showMessage(response.message)
        this.dialogRef.close(true)
      },
      error: (err) => {
        this.messageService.showMessage(err.error.message)
        this.wSubmit.set(false);
      },
    })
  }

}

import { 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  Component, 
  DestroyRef, 
  Injector, 
  OnInit, 
  Signal, 
  computed, 
  inject, 
  signal 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';

// Material Modules
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';

// Importação segura do Moment
import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

// Services, Enums & Validators
import { PatientRequestService } from '../../../services/patient-request.service';
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';

export interface OptionItem {
  id?: number;
  name?: string;
  code?: string;
  lawsuit?: boolean;
  has_entrance_or_lawsuit?: boolean;
  has_entrance_or_lawsuit_finished?: boolean;
  [key: string]: any;
}

@Component({
  selector: 'app-patient-request-update',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './patient-request-update.component.html',
  styleUrl: './patient-request-update.component.scss',
  providers: [
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' } 
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    patient_search: [{ type: 'required', message: 'A seleção do paciente é obrigatória.' }],
    cid_search: [{ type: 'required', message: 'A seleção de um CID/Laudo é obrigatória.' }],
    hospital_search: [{ type: 'required', message: 'A unidade hospitalar é obrigatória.' }],
    type: [{ type: 'required', message: 'Selecione o tipo de solicitação.' }],
    consultation_date: [
      { type: 'required', message: 'A data do agendamento é obrigatória.' },
      { type: 'invalidDate', message: 'Digite uma data válida.' }
    ],
    observation: [{ type: 'required', message: 'Insira uma observação para a solicitação.' }]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isScheduling = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);
  
  protected readonly patientLoading = signal<boolean>(false);
  protected readonly patientReadOnly = signal<boolean>(true);

  protected readonly cidLoading = signal<boolean>(false);
  protected readonly cidReadOnly = signal<boolean>(true);

  protected readonly hospitalLoading = signal<boolean>(false);
  protected readonly hospitalReadOnly = signal<boolean>(true);

  protected readonly currentReportFlags = signal<{ lawsuit: boolean; hasEntranceOrLawsuit: boolean } | null>(null);

  // Opções em Signals (Writable)
  private readonly patientOptions = signal<OptionItem[]>([]);
  private readonly cidOptions = signal<OptionItem[]>([]);
  private readonly hospitalOptions = signal<OptionItem[]>([]);

  // ==========================================
  // Formularização e Inputs em Signals
  // ==========================================
  protected patientRequestForm!: FormGroup;

  // Signals (Read-only) conectados aos controles
  private patientSearchValue!: Signal<string | OptionItem>;
  private cidSearchValue!: Signal<string | OptionItem>;
  private hospitalSearchValue!: Signal<string | OptionItem>;

  // Listas Filtradas Reativas (Computed Signals)
  protected readonly filteredPatientOptions = computed(() => {
    const val = this.patientSearchValue ? this.patientSearchValue() : '';
    const query = typeof val === 'string' ? val.toLowerCase() : val?.name?.toLowerCase() || '';
    return query 
      ? this.patientOptions().filter(opt => opt.name?.toLowerCase().includes(query)) 
      : this.patientOptions();
  });

  protected readonly filteredCidOptions = computed(() => {
    const val = this.cidSearchValue ? this.cidSearchValue() : '';
    const query = typeof val === 'string' ? val.toLowerCase() : (val?.code ? `${val.code} - ${val.name}`.toLowerCase() : '');
    return query 
      ? this.cidOptions().filter(opt => opt.name?.toLowerCase().includes(query) || opt.code?.toLowerCase().includes(query)).slice(0, 10) 
      : this.cidOptions().slice(0, 10);
  });

  protected readonly filteredHospitalOptions = computed(() => {
    const val = this.hospitalSearchValue ? this.hospitalSearchValue() : '';
    const query = typeof val === 'string' ? val.toLowerCase() : val?.name?.toLowerCase() || '';
    return query 
      ? this.hospitalOptions().filter(opt => opt.name?.toLowerCase().includes(query)) 
      : this.hospitalOptions();
  });

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
    this.loadInitialDialogData();
    this.registerCleaners();
  }

  // ==========================================
  // Inicialização do Formulário e Signals
  // ==========================================
  private initForm(): void {
    const request = this.data.patient_request;
    const initialDate = request.consultation_date ? moment(request.consultation_date) : null;

    this.patientRequestForm = this.fb.group({
      patient_search: [null, [Validators.required]],
      report_id: [request.report_id, [Validators.required]],
      cid_search: [null, [Validators.required]],
      type: [{ value: request.type, disabled: true }, [Validators.required]],
      consultation_date: [{ value: initialDate, disabled: true }],
      hospital_unity_id: [request.hospital_unity_id, [Validators.required]],
      hospital_search: [null, [Validators.required]],
      observation: [request.observation, [Validators.required]]
    });

    const patientCtrl = this.patientRequestForm.get('patient_search')!;
    const cidCtrl = this.patientRequestForm.get('cid_search')!;
    const hospitalCtrl = this.patientRequestForm.get('hospital_search')!;

    this.patientSearchValue = toSignal(patientCtrl.valueChanges, { 
      initialValue: '', 
      injector: this.injector 
    });

    this.cidSearchValue = toSignal(cidCtrl.valueChanges, { 
      initialValue: '', 
      injector: this.injector 
    });

    this.hospitalSearchValue = toSignal(hospitalCtrl.valueChanges, { 
      initialValue: '', 
      injector: this.injector 
    });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        const form = this.patientRequestForm;

        if (isSubmitting) {
          form.disable({ emitEvent: false });
        } else {
          form.enable({ emitEvent: false });
          
          form.get('type')?.disable({ emitEvent: false });

          if (!this.isScheduling()) {
            form.get('consultation_date')?.disable({ emitEvent: false });
          }
        }

        this.cdr.markForCheck();
      });
  }

  private registerCleaners(): void {
    this.patientRequestForm.get('patient_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('cid_search')?.setValue('');
          this.patientRequestForm.get('report_id')?.setValue(null);
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.cidOptions.set([]);
          this.cidReadOnly.set(true);
          this.currentReportFlags.set(null);
          this.resetTypeSelection();
          this.cdr.markForCheck();
        }
      });

    this.patientRequestForm.get('cid_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('report_id')?.setValue(null);
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.currentReportFlags.set(null);
          this.resetTypeSelection();
          this.cdr.markForCheck();
        }
      });

    this.patientRequestForm.get('hospital_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('hospital_unity_id')?.setValue(null);
          this.patientRequestForm.get('hospital_unity_id')?.markAsDirty();
        }
      });
  }

  // ==========================================
  // Carga de Dados Iniciais
  // ==========================================
  private loadInitialDialogData(): void {
    this.patientLoading.set(true);
    this.hospitalLoading.set(true);
    this.cidLoading.set(true);

    const request = this.data.patient_request;
    const currentPatientCareId = request.report?.patient_care?.id;

    forkJoin({
      patients: this.patientRequestService.getPatients(),
      hospitals: this.patientRequestService.getHospitalUnities(),
      cids: currentPatientCareId ? this.patientRequestService.getReports(currentPatientCareId) : []
    }).pipe(
      finalize(() => {
        this.patientLoading.set(false);
        this.hospitalLoading.set(false);
        this.cidLoading.set(false);
        this.cdr.markForCheck();
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        const mappedPatients = (res.patients || [])
          .filter((item: any) => item.status && item.is_valid)
          .map((item: any) => ({ name: item.patient?.name || '', ...item }));
        
        this.patientOptions.set(mappedPatients);
        
        const initialPatient = request.report?.patient_care?.patient;
        if (initialPatient) {
          this.patientRequestForm.get('patient_search')?.setValue(initialPatient);
        }
        this.patientReadOnly.set(false);

        const mappedHospitals = (res.hospitals || []).map((item: any) => ({ ...item }));
        this.hospitalOptions.set(mappedHospitals);
        
        const initialHospital = request.hospital_unity;
        if (initialHospital) {
          this.patientRequestForm.get('hospital_search')?.setValue(initialHospital);
        }
        this.hospitalReadOnly.set(false);

        if (currentPatientCareId) {
          const mappedCids = (res.cids || []).map((item: any) => ({
            ...item.cid,
            ...item
          }));
          this.cidOptions.set(mappedCids);
          
          if (request.report?.cid) {
            const currentCid = mappedCids.find(c => c.code === request.report.cid.code);
            const reportToUse = currentCid || request.report;
            this.patientRequestForm.get('cid_search')?.setValue(reportToUse);

            const lawsuit = !!reportToUse.lawsuit;
            const hasEntranceOrLawsuit = !!reportToUse.has_entrance_or_lawsuit;
            this.currentReportFlags.set({ lawsuit, hasEntranceOrLawsuit });

            this.setType(request.type);
          }
          this.cidReadOnly.set(false);
        }
      },
      error: () => {
        this.messageService.showMessage('Erro ao carregar dados cadastrais da solicitação.');
        this.patientReadOnly.set(true);
        this.hospitalReadOnly.set(true);
        this.cidReadOnly.set(true);
      }
    });
  }

  private fetchCidsForPatient(patientCareId: number): void {
    this.cidLoading.set(true);
    this.cidReadOnly.set(true);

    this.patientRequestService.getReports(patientCareId)
      .pipe(
        finalize(() => {
          this.cidLoading.set(false);
          this.cidReadOnly.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          const mapped = (response || []).map((item: any) => ({ 
            ...item.cid, 
            ...item
          }));
          this.cidOptions.set(mapped);
        }
      });
  }

  // ==========================================
  // Helpers de Exibição e Seleção
  // ==========================================
  protected displayPatient(patient: OptionItem): string {
    return patient?.name || '';
  }

  protected displayCid(report: OptionItem): string {
    return report?.code && report?.name ? `${report.code} - ${report.name}` : '';
  }

  protected displayHospitalUnity(hospitalUnity: OptionItem): string {
    return hospitalUnity?.name || '';
  }

  protected setPatient(patientCare: OptionItem): void {
    if (patientCare?.id) {
      this.patientRequestForm.get('cid_search')?.setValue('');
      this.patientRequestForm.get('report_id')?.setValue(null);
      this.patientRequestForm.get('report_id')?.markAsDirty();

      this.currentReportFlags.set(null);
      this.resetTypeSelection();
      this.fetchCidsForPatient(patientCare.id);
    }
  }

  protected setCid(report: OptionItem): void {
    if (report?.id) {
      const originalRequest = this.data.patient_request;
      this.patientRequestForm.get('report_id')?.setValue(report.id);
      this.patientRequestForm.get('report_id')?.markAsDirty();

      const lawsuit = !!report.lawsuit;
      const hasEntranceOrLawsuit = !!report.has_entrance_or_lawsuit;
      this.currentReportFlags.set({ lawsuit, hasEntranceOrLawsuit });

      const typeCtrl = this.patientRequestForm.get('type');

      if (report.id !== originalRequest.report_id) {
        let autoValue: string | null = null;

        if (hasEntranceOrLawsuit) {
          autoValue = 'Agendamento';
        } else {
          autoValue = lawsuit ? 'Ação Judicial' : 'Entrada';
        }

        if (autoValue) {
          typeCtrl?.setValue(autoValue);
          typeCtrl?.markAsDirty();
          typeCtrl?.disable();
          this.setType(autoValue);
        }
      } else {
        typeCtrl?.setValue(originalRequest.type);
        typeCtrl?.disable();
        this.setType(originalRequest.type);
      }

      this.cdr.markForCheck();
    }
  }

  protected setHospitalUnity(hospital: OptionItem): void {
    if (hospital?.id) {
      this.patientRequestForm.get('hospital_unity_id')?.setValue(hospital.id);
      this.patientRequestForm.get('hospital_unity_id')?.markAsDirty();
    }
  }

  protected setType(value: string): void {
    const isSched = value === 'Agendamento' || value === 'Ação Judicial';
    this.isScheduling.set(isSched);

    const dateControl = this.patientRequestForm.get('consultation_date');
    if (dateControl) {
      if (isSched) {
        dateControl.enable();
        dateControl.setValidators([Validators.required, CustomValidators.dateValidator()]);
      } else {
        dateControl.disable();
        dateControl.setValue(null);
        dateControl.clearValidators();
      }
      dateControl.updateValueAndValidity();
    }
    this.cdr.markForCheck();
  }

  protected setConsultationDate(event: MatDatepickerInputEvent<any>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      this.patientRequestForm.get('consultation_date')?.setValue(parsedDate, { emitEvent: true });
      this.patientRequestForm.get('consultation_date')?.markAsDirty();
      this.cdr.markForCheck();
    }
  }

  protected onlyNumbersAndSlashes(event: KeyboardEvent): boolean {
    const charCode = event.key;
    const allowedCharacters = /^[0-9\/]$/;
    
    if (!allowedCharacters.test(charCode)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  private resetTypeSelection(): void {
    const typeControl = this.patientRequestForm.get('type');
    const dateControl = this.patientRequestForm.get('consultation_date');

    if (typeControl) {
      typeControl.setValue(null);
      typeControl.markAsUntouched();
    }

    if (dateControl) {
      dateControl.setValue(null);
      dateControl.disable();
      dateControl.clearValidators();
      dateControl.updateValueAndValidity();
    }

    this.isScheduling.set(false);
  }

  // ==========================================
  // Submissão do Formulário
  // ==========================================
  protected onSubmit(): void {
    const patientRequestId = this.data?.patient_request?.id;
    if (!patientRequestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    if (this.patientRequestForm.invalid) {
      this.patientRequestForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    const payload = this.patientRequestForm.getRawValue();

    this.patientRequestService.updatePatientRequest(patientRequestId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.messageService.showMessage(response?.message || 'Solicitação de paciente atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Houve um erro operacional ao atualizar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, startWith } from 'rxjs';

// Angular Material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
  maxAutocompleteResults: 10,
} as const;

export type PatientRequestProcessDialogData = {
  patient_request?: PatientRequest;
};

export interface ProfessionalOption {
  id: number | string;
  name: string;
  requests_count?: number;
}

export interface GroupedProfessionalsResponse {
  medical_professionals?: ProfessionalOption[];
  social_professionals?: ProfessionalOption[];
  travel_professionals?: ProfessionalOption[];
  cost_assistance_professionals?: ProfessionalOption[];
}

@Component({
  selector: 'app-patient-request-process',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-request-process.component.html',
  styleUrl: './patient-request-process.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestProcessComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestProcessDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly fb = inject(FormBuilder);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestProcessComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected processForm!: FormGroup;

  protected readonly medicalProfessionalControl = new FormControl<string | ProfessionalOption>(
    '',
    { nonNullable: true }
  );
  protected readonly socialProfessionalControl = new FormControl<string | ProfessionalOption>(
    '',
    { nonNullable: true }
  );
  protected readonly travelProfessionalControl = new FormControl<string | ProfessionalOption>(
    '',
    { nonNullable: true }
  );
  protected readonly costAssistanceProfessionalControl = new FormControl<string | ProfessionalOption>(
    '',
    { nonNullable: true }
  );

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isLoadingProfessionals = signal<boolean>(false);
  protected readonly isReadOnly = signal<boolean>(false);

  private readonly requestType = signal<string | null>(
    this.data?.patient_request?.type ?? null
  );

  protected readonly isEntranceType = computed(
    () => this.requestType()?.toLowerCase() === 'entrada'
  );

  private readonly medicalPool = signal<ProfessionalOption[]>([]);
  private readonly socialPool = signal<ProfessionalOption[]>([]);
  private readonly travelPool = signal<ProfessionalOption[]>([]);
  private readonly costAssistancePool = signal<ProfessionalOption[]>([]);

  private readonly medicalQuery = toSignal(
    this.medicalProfessionalControl.valueChanges.pipe(
      startWith(this.medicalProfessionalControl.value ?? ''),
      map((value) => (typeof value === 'string' ? value : value?.name ?? ''))
    ),
    { initialValue: '' }
  );

  private readonly socialQuery = toSignal(
    this.socialProfessionalControl.valueChanges.pipe(
      startWith(this.socialProfessionalControl.value ?? ''),
      map((value) => (typeof value === 'string' ? value : value?.name ?? ''))
    ),
    { initialValue: '' }
  );

  private readonly travelQuery = toSignal(
    this.travelProfessionalControl.valueChanges.pipe(
      startWith(this.travelProfessionalControl.value ?? ''),
      map((value) => (typeof value === 'string' ? value : value?.name ?? ''))
    ),
    { initialValue: '' }
  );

  private readonly costAssistanceQuery = toSignal(
    this.costAssistanceProfessionalControl.valueChanges.pipe(
      startWith(this.costAssistanceProfessionalControl.value ?? ''),
      map((value) => (typeof value === 'string' ? value : value?.name ?? ''))
    ),
    { initialValue: '' }
  );

  protected readonly filteredMedicalOptions = computed(() =>
    this.filterOptions(this.medicalQuery(), this.medicalPool())
  );

  protected readonly filteredSocialOptions = computed(() =>
    this.filterOptions(this.socialQuery(), this.socialPool())
  );

  protected readonly filteredTravelOptions = computed(() =>
    this.filterOptions(this.travelQuery(), this.travelPool())
  );

  protected readonly filteredCostAssistanceOptions = computed(() =>
    this.filterOptions(this.costAssistanceQuery(), this.costAssistancePool())
  );

  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    medical_professional_id: [
      { type: 'required', message: 'A seleção do profissional médico é obrigatória.' },
    ],
    social_professional_id: [
      { type: 'required', message: 'A seleção do assistente social é obrigatória.' },
    ],
    travel_professional_id: [
      { type: 'required', message: 'A seleção do responsável por passagens é obrigatória.' },
    ],
    cost_assistance_professional_id: [
      { type: 'required', message: 'A seleção do responsável por ajuda de custo é obrigatória.' },
    ],
  };

  // ==========================================
  // Construtor
  // ==========================================
  constructor() {
    effect(() => {
      const disabled = this.isLoadingProfessionals() || this.isSubmitting();
      this.setControlsDisabled(disabled);
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupTypeChangeListener();
    this.setupAutocompleteSelectionSync();
    this.fetchAllProfessionals();
  }

  ngOnDestroy(): void {
    this.requestsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected displayProfessionalFn(professional: ProfessionalOption | string | null): string {
    if (!professional || typeof professional === 'string') {
      return professional ?? '';
    }
    return professional.name || '';
  }

  protected isFormInvalid(): boolean {
    return (
      !this.processForm ||
      this.processForm.invalid ||
      this.processForm.pending ||
      this.isSubmitting() ||
      this.isLoadingProfessionals()
    );
  }

  protected onSubmit(): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    if (this.processForm.invalid) {
      this.processForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.processForm.getRawValue();

    this.patientRequestService
      .processPatientRequest(requestId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(
            response?.message || 'Solicitação processada com sucesso!'
          );
          this.requestsChannel.postMessage('update');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Houve um erro operacional ao processar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const initialType = this.data?.patient_request?.type ?? null;
    this.requestType.set(initialType);

    this.processForm = this.fb.group({
      type: [initialType],
      medical_professional_id: [null, [Validators.required]],
      social_professional_id: [null, [Validators.required]],
      travel_professional_id: [null],
      cost_assistance_professional_id: [null],
    });

    if (initialType?.toLowerCase() !== 'entrada') {
      this.processForm.get('travel_professional_id')?.setValidators([Validators.required]);
      this.processForm.get('cost_assistance_professional_id')?.setValidators([Validators.required]);
    }
  }

  private setupTypeChangeListener(): void {
    this.processForm
      .get('type')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((typeValue: string | null) => {
        this.requestType.set(typeValue);
        const isEntrada = typeValue?.toLowerCase() === 'entrada';

        const travelCtrl = this.processForm.get('travel_professional_id');
        const costCtrl = this.processForm.get('cost_assistance_professional_id');

        if (isEntrada) {
          travelCtrl?.clearValidators();
          travelCtrl?.setValue(null);

          costCtrl?.clearValidators();
          costCtrl?.setValue(null);

          this.travelProfessionalControl.setValue('');
          this.costAssistanceProfessionalControl.setValue('');
        } else {
          travelCtrl?.setValidators([Validators.required]);
          costCtrl?.setValidators([Validators.required]);
        }

        travelCtrl?.updateValueAndValidity();
        costCtrl?.updateValueAndValidity();
      });
  }

  private setupAutocompleteSelectionSync(): void {
    this.bindProfessionalControl(this.medicalProfessionalControl, 'medical_professional_id');
    this.bindProfessionalControl(this.socialProfessionalControl, 'social_professional_id');
    this.bindProfessionalControl(this.travelProfessionalControl, 'travel_professional_id');
    this.bindProfessionalControl(
      this.costAssistanceProfessionalControl,
      'cost_assistance_professional_id'
    );
  }

  private bindProfessionalControl(
    control: FormControl<string | ProfessionalOption | null>,
    formControlName: string
  ): void {
    control.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        const id = typeof val === 'object' && val !== null ? val.id : null;
        this.processForm.get(formControlName)?.setValue(id);
      });
  }

  private fetchAllProfessionals(): void {
    this.isLoadingProfessionals.set(true);

    this.patientRequestService
      .getProfessionals()
      .pipe(
        finalize(() => this.isLoadingProfessionals.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: unknown) => {
          if (Array.isArray(response)) {
            this.medicalPool.set(response);
            this.socialPool.set(response);
            this.travelPool.set(response);
            this.costAssistancePool.set(response);
          } else if (response && typeof response === 'object') {
            const grouped = response as GroupedProfessionalsResponse;
            this.medicalPool.set(grouped.medical_professionals ?? []);
            this.socialPool.set(grouped.social_professionals ?? []);
            this.travelPool.set(grouped.travel_professionals ?? []);
            this.costAssistancePool.set(grouped.cost_assistance_professionals ?? []);
          } else {
            this.clearAllOptions();
          }

          this.isReadOnly.set(false);
        },
        error: () => {
          this.isReadOnly.set(true);
          this.clearAllOptions();
        },
      });
  }

  private setControlsDisabled(disabled: boolean): void {
    const controls = [
      this.medicalProfessionalControl,
      this.socialProfessionalControl,
      this.travelProfessionalControl,
      this.costAssistanceProfessionalControl,
    ];

    if (disabled) {
      this.processForm?.disable({ emitEvent: false });
      controls.forEach((ctrl) => ctrl.disable({ emitEvent: false }));
    } else {
      this.processForm?.enable({ emitEvent: false });
      controls.forEach((ctrl) => ctrl.enable({ emitEvent: false }));
    }
  }

  private clearAllOptions(): void {
    this.medicalPool.set([]);
    this.socialPool.set([]);
    this.travelPool.set([]);
    this.costAssistancePool.set([]);
  }

  private filterOptions(term: string, options: ProfessionalOption[]): ProfessionalOption[] {
    if (!Array.isArray(options)) {
      return [];
    }

    const normalizedTerm = term.trim().toLowerCase();
    const list = normalizedTerm
      ? options.filter((option) => option?.name?.toLowerCase().includes(normalizedTerm))
      : options;

    return list.slice(0, COMPONENT_CONFIG.maxAutocompleteResults);
  }
}
import { CommonModule } from '@angular/common';
import { 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  Component, 
  DestroyRef, 
  Injector, 
  OnInit, 
  inject, 
  signal 
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

// Services e Models
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

export interface UnifiedPassengerOption {
  id: number;
  name: string;
  isPatient: boolean;
  typeLabel: string;
}

@Component({
  selector: 'app-patient-request-cost-assistance-update',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './patient-request-cost-assistance-update.component.html',
  styleUrl: './patient-request-cost-assistance-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCostAssistanceUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestCostAssistanceUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    name: [
      { type: 'required', message: 'O nome da ajuda de custo é obrigatório.' }
    ],
    type: [
      { type: 'required', message: 'O tipo da ajuda de custo é obrigatório.' }
    ]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly passengersOptions = signal<UnifiedPassengerOption[]>([]);
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // FormGroups
  // ==========================================
  protected updateCostAssistanceForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.extractPassengers();
    this.initForm();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Inicialização do Formulário
  // ==========================================
  private initForm(): void {
    const costAssistance = this.data?.cost_assistance;

    this.updateCostAssistanceForm = this.fb.group({
      name: [costAssistance?.name || null, [Validators.required]],
      type: [{ value: costAssistance?.type || null, disabled: true }, [Validators.required]],
      passenger_id: [costAssistance?.passenger_id || null],
      bank: [costAssistance?.bank || null],
      agency: [costAssistance?.agency || null],
      account: [costAssistance?.account || null]
    });
  }

  // ==========================================
  // Handlers Reativos
  // ==========================================
  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.updateCostAssistanceForm.disable({ emitEvent: false });
        } else {
          this.updateCostAssistanceForm.enable({ emitEvent: false });
          // Mantém o campo de tipo sempre desabilitado
          this.updateCostAssistanceForm.get('type')?.disable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Helpers e Métodos Auxiliares
  // ==========================================
  private extractPassengers(): void {
    const travels = this.data?.patient_request?.travels || this.data?.cost_assistance?.patient_request?.travels || [];
    const mapPassengers = new Map<string, UnifiedPassengerOption>();

    for (const travel of travels) {
      const passengers = travel?.passengers || [];

      for (const item of passengers) {
        const isPatient = !!item?.is_patient;
        const entity = isPatient ? (item?.patient || item) : item?.escort;

        if (entity?.id) {
          const mapKey = `${isPatient ? 'patient' : 'escort'}-${entity.id}`;

          if (!mapPassengers.has(mapKey)) {
            mapPassengers.set(mapKey, {
              id: item.id,
              name: entity.name || entity.full_name || `Passageiro ${entity.id}`,
              isPatient,
              typeLabel: isPatient ? 'Paciente' : 'Acompanhante'
            });
          }
        }
      }
    }

    this.passengersOptions.set(Array.from(mapPassengers.values()));
  }

  // ==========================================
  // Submissão do Formulário
  // ==========================================
  protected onSubmit(): void {
    const costAssistanceId = this.data?.cost_assistance?.id;

    if (!costAssistanceId) {
      this.messageService.showMessage('Identificador da ajuda de custo não encontrado.');
      return;
    }

    if (this.updateCostAssistanceForm.invalid) {
      this.updateCostAssistanceForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.updateCostAssistanceForm.getRawValue();

    this.costAssistanceService.updateCostAssistance(costAssistanceId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Ajuda de custo atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao atualizar a ajuda de custo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}
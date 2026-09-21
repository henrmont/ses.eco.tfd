import { CommonModule, CurrencyPipe } from '@angular/common';
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
import { finalize } from 'rxjs';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

// Core, Enums, Interfaces e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { TravelGender } from '../../../enums/travel-gender';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

export interface UnifiedPassengerOption {
  id: number;
  name: string;
  isPatient: boolean;
  typeLabel: string;
  birthDate?: string | Date | null;
}

@Component({
  selector: 'app-travel-passenger-create',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
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
  templateUrl: './travel-passenger-create.component.html',
  styleUrl: './travel-passenger-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelPassengerCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<TravelPassengerCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    passenger: [
      { type: 'required', message: 'A seleção do passageiro é obrigatória.' },
      { type: 'passengerExists', message: 'Este passageiro já está cadastrado nesta viagem.' }
    ],
    tariff: [
      { type: 'required', message: 'O valor é obrigatório.' },
      { type: 'min', message: 'O valor não pode ser negativo.' }
    ],
    tax: [
      { type: 'required', message: 'O valor é obrigatório.' },
      { type: 'min', message: 'O valor não pode ser negativo.' }
    ],
    discount: [
      { type: 'min', message: 'O valor não pode ser negativo.' }
    ],
    gender: [],
    seat: [],
    ticket: []
  };

  // ==========================================
  // Listagens Estáticas (Enums)
  // ==========================================
  protected readonly genders = Object.entries(TravelGender).map(([key, value]) => ({ key, value }));

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly passengersOptions = signal<UnifiedPassengerOption[]>([]);
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // FormGroups
  // ==========================================
  protected createPassengerForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
    this.setPassengerOptions();
  }

  // ==========================================
  // Inicialização de Formulário
  // ==========================================
  private initForm(): void {
    const travelId = this.data?.travel?.id;

    this.createPassengerForm = this.fb.group({
      passenger: [null, [Validators.required], [this.travelService.passengerExistsValidator(travelId)]],
      tariff: [null, [Validators.required, Validators.min(0)]],
      tax: [null, [Validators.required, Validators.min(0)]],
      discount: [null, [Validators.min(0)]],
      gender: [null],
      seat: [null],
      ticket: [null]
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
          this.createPassengerForm.disable({ emitEvent: false });
        } else {
          this.createPassengerForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Helpers e Métodos Auxiliares
  // ==========================================
  /**
   * Unifica pacientes e acompanhantes ativos em uma única lista rotulada.
   */
  private setPassengerOptions(): void {
    const reportData = this.data?.travel?.patient_request?.report?.patient_care;

    if (!reportData) {
      this.passengersOptions.set([]);
      return;
    }

    const options: UnifiedPassengerOption[] = [];

    // Adiciona Paciente (se existir)
    if (reportData.patient) {
      options.push({
        id: reportData.patient.id,
        name: reportData.patient.name,
        isPatient: true,
        typeLabel: 'Paciente',
        birthDate: reportData.patient.birth_date ?? null
      });
    }

    // Adiciona apenas Acompanhantes ativos com status === true
    if (Array.isArray(reportData.escorts)) {
      for (const escort of reportData.escorts) {
        if (escort?.status === true) {
          options.push({
            id: escort.id,
            name: escort.name,
            isPatient: false,
            typeLabel: 'Acompanhante',
            birthDate: escort.birth_date ?? null
          });
        }
      }
    }

    this.passengersOptions.set(options);
  }

  /**
   * Calcula se o passageiro é ADT (Adulto) ou CHD (Criança)
   * com base na data de nascimento em relação à data atual.
   * Idade > 11 anos -> ADT | Idade <= 11 anos -> CHD.
   */
  private calculatePassengerType(birthDateInput?: string | Date | null): 'ADT' | 'CHD' {
    if (!birthDateInput) {
      return 'ADT';
    }

    const birthDate = new Date(birthDateInput);
    const now = new Date();

    let age = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }

    return age > 11 ? 'ADT' : 'CHD';
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const travelId = this.data?.travel?.id;

    if (this.createPassengerForm.invalid || !travelId) {
      this.createPassengerForm.markAllAsTouched();
      return;
    }

    const selectedOption = this.createPassengerForm.get('passenger')?.value as UnifiedPassengerOption;

    if (!selectedOption) {
      return;
    }

    this.isSubmitting.set(true);

    const rawValue = this.createPassengerForm.getRawValue();

    const payload = {
      is_patient: selectedOption.isPatient,
      passenger_id: selectedOption.id,
      type: this.calculatePassengerType(selectedOption.birthDate),
      tariff: rawValue.tariff,
      tax: rawValue.tax,
      discount: rawValue.discount,
      gender: rawValue.gender,
      seat: rawValue.seat,
      ticket: rawValue.ticket
    };

    this.travelService.createPassenger(travelId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Passageiro adicionado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao processar o cadastro do passageiro.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}
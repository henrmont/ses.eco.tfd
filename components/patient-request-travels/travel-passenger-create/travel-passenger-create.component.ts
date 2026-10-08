import { CommonModule, CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

// Services, Models & Enums
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { TravelGender } from '../../../enums/travel-gender';
import { PatientRequestTravel } from '../../../models/patient-request-travel.model';
import { TravelPassenger } from '../../../models/travel-passenger.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export interface UnifiedPassengerOption {
  id?: number;
  name?: string;
  isPatient?: boolean;
  typeLabel?: string;
  birthDate?: string | Date | null;
}

export type TravelPassengerCreateDialogData = {
  travel?: PatientRequestTravel;
  currentPassengers?: TravelPassenger[];
};

interface ErrorMessage {
  type: string;
  message: string;
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
  protected readonly data = inject<TravelPassengerCreateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<TravelPassengerCreateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected createPassengerForm!: FormGroup;

  protected readonly passengersOptions = signal<UnifiedPassengerOption[]>([]);
  protected readonly isSubmitting = signal<boolean>(false);

  // Listagens Estáticas (Enums)
  protected readonly genders = Object.entries(TravelGender).map(([key, value]) => ({ key, value }));

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
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
  // Construtor com Lógica Reativa (Effect)
  // ==========================================
  constructor() {
    effect(() => {
      const submitting = this.isSubmitting();

      if (!this.createPassengerForm) return;

      if (submitting) {
        this.createPassengerForm.disable({ emitEvent: false });
      } else {
        this.createPassengerForm.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setPassengerOptions();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
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
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Passageiro adicionado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao processar o cadastro do passageiro.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const travelId = this.data?.travel?.id;

    this.createPassengerForm = this.fb.group({
      passenger: [null, [Validators.required]],
      tariff: [null, [Validators.required, Validators.min(0)]],
      tax: [null, [Validators.required, Validators.min(0)]],
      discount: [null, [Validators.min(0)]],
      gender: [null],
      seat: [null],
      ticket: [null]
    });
  }

  /**
   * Unifica os candidatos aptos (paciente + acompanhantes ativos) e 
   * filtra os que já estão na lista atual de passageiros cadastrados.
   */
  private setPassengerOptions(): void {
    const reportData = this.data?.travel?.patient_request?.report?.patient_care;

    if (!reportData) {
      this.passengersOptions.set([]);
      return;
    }

    // 1. Extrai a lista atual de passageiros
    const rawData: any = this.data;
    const rawList = 
      rawData?.currentPassengers ?? 
      rawData?.passengers ?? 
      rawData?.travel?.passengers ?? 
      [];

    const currentList: any[] = Array.isArray(rawList)
      ? rawList
      : rawList?.data ?? Array.from(rawList ?? []);

    // 2. Extrai as chaves dos passageiros já adicionados
    const attachedKeys = new Set(
      currentList.map((item: any) => {
        const isPatient = item.is_patient ?? item.isPatient ?? item.typeLabel === 'Paciente';
        
        // Busca o ID real da pessoa (Paciente ou Acompanhante) de acordo com o tipo
        const realId = isPatient
          ? (item.patient_id ?? item.patient?.id ?? item.passenger_id ?? item.id)
          : (item.escort_id ?? item.escort?.id ?? item.passenger_id ?? item.id);

        return `${String(realId)}_${String(Boolean(isPatient))}`;
      })
    );

    // 3. Monta a lista de candidatos
    const candidates: UnifiedPassengerOption[] = [];

    // Paciente
    if (reportData.patient) {
      candidates.push({
        id: reportData.patient.id,
        name: reportData.patient.name,
        isPatient: true,
        typeLabel: 'Paciente',
        birthDate: reportData.patient.birth_date ?? null
      });
    }

    // Acompanhantes ativos
    if (Array.isArray(reportData.escorts)) {
      for (const escort of reportData.escorts) {
        if (escort?.status === true) {
          candidates.push({
            id: escort.id,
            name: escort.name,
            isPatient: false,
            typeLabel: 'Acompanhante',
            birthDate: escort.birth_date ?? null
          });
        }
      }
    }

    // 4. Filtra removendo quem já está vinculado
    const items = candidates.filter(item => {
      const key = `${String(item.id)}_${String(Boolean(item.isPatient))}`;
      return !attachedKeys.has(key);
    });

    this.passengersOptions.set(items);
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
}
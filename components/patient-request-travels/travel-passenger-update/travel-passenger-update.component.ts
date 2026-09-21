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
import { finalize } from 'rxjs/operators';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

// Core, Enums, Models & Serviços
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { TravelGender } from '../../../enums/travel-gender';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

@Component({
  selector: 'app-travel-passenger-update',
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
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  templateUrl: './travel-passenger-update.component.html',
  styleUrl: './travel-passenger-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelPassengerUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<TravelPassengerUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades de Domínio e Suporte
  // ==========================================
  protected readonly genders = Object.entries(TravelGender).map(([key, value]) => ({ key, value }));

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    tariff: [
      { type: 'required', message: 'O valor da tarifa é obrigatório.' },
      { type: 'min', message: 'O valor da tarifa não pode ser negativo.' }
    ],
    tax: [
      { type: 'required', message: 'O valor da taxa é obrigatório.' },
      { type: 'min', message: 'O valor da taxa não pode ser negativo.' }
    ],
    discount: [
      { type: 'min', message: 'O desconto não pode ser menor que 0%.' },
      { type: 'max', message: 'O desconto não pode exceder 100%.' }
    ],
    gender: [],
    seat: [],
    ticket: []
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly passengerDisplayName = signal<string>('');
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Formulário Principal
  // ==========================================
  protected passengerForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
    this.setPassengerDisplayName();
  }

  // ==========================================
  // Inicialização de Formulário
  // ==========================================
  private initForm(): void {
    const passenger = this.data?.passenger;

    this.passengerForm = this.fb.group({
      tariff: [passenger?.tariff ?? null, [Validators.required, Validators.min(0)]],
      tax: [passenger?.tax ?? null, [Validators.required, Validators.min(0)]],
      discount: [passenger?.discount ?? null, [Validators.min(0), Validators.max(100)]],
      gender: [passenger?.gender ?? null],
      seat: [passenger?.seat ?? null],
      ticket: [passenger?.ticket ?? null]
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
          this.passengerForm.disable({ emitEvent: false });
        } else {
          this.passengerForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Helpers e Métodos Auxiliares
  // ==========================================
  /**
   * Formata o nome do passageiro (Paciente ou Acompanhante) para exibição read-only.
   */
  private setPassengerDisplayName(): void {
    const passenger = this.data?.passenger;

    if (!passenger) {
      this.passengerDisplayName.set('Não informado');
      return;
    }

    const name = passenger?.patient?.name || passenger?.escort?.name || 'Passageiro Desconhecido';
    const typeLabel = passenger?.is_patient ? 'Paciente' : 'Acompanhante';

    this.passengerDisplayName.set(`${name} (${typeLabel})`);
  }

  // ==========================================
  // Submissão do Formulário
  // ==========================================
  protected onSubmit(): void {
    const passengerId = this.data?.passenger?.id;

    if (!passengerId) {
      this.messageService.showMessage('Identificador do passageiro não encontrado.');
      return;
    }

    if (this.passengerForm.invalid) {
      this.passengerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.travelService.updatePassenger(passengerId, this.passengerForm.getRawValue())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Passageiro atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao processar a atualização do passageiro.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}
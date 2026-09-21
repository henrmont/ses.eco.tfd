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

import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Models, Validators & Serviços
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

@Component({
  selector: 'app-travel-route-create',
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
    MatDatepickerModule,
    MatNativeDateModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  templateUrl: './travel-route-create.component.html',
  styleUrl: './travel-route-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelRouteCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<TravelRouteCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    origin: [
      { type: 'required', message: 'A cidade de origem é obrigatória.' }
    ],
    destination: [
      { type: 'required', message: 'A cidade de destino é obrigatória.' }
    ],
    distance: [
      { type: 'min', message: 'A distância não pode ser negativa.' }
    ],
    departure: [
      { type: 'invalidDate', message: 'Data de saída inválida.' }
    ],
    arrival: [
      { type: 'invalidDate', message: 'Data de chegada inválida.' }
    ],
    flight: [],
    airplane: [],
    class: [],
    scales: [],
    family: []
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Formulário Principal
  // ==========================================
  protected createRouteForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Inicialização de Formulário
  // ==========================================
  private initForm(): void {
    this.createRouteForm = this.fb.group({
      flight: [null],
      airplane: [null],
      departure: [null, [CustomValidators.dateValidator()]],
      arrival: [null, [CustomValidators.dateValidator()]],
      origin: [null, [Validators.required]],
      destination: [null, [Validators.required]],
      distance: [null, [Validators.min(0)]],
      class: [null],
      scales: [null],
      family: [null]
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
          this.createRouteForm.disable({ emitEvent: false });
        } else {
          this.createRouteForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Handlers do Template e Auxiliares
  // ==========================================
  protected setDepartureDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        this.createRouteForm.get('departure')?.setValue(parsedDate, { emitEvent: true });
        this.createRouteForm.get('departure')?.markAsDirty();
      }
    }
  }

  protected setArrivalDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        this.createRouteForm.get('arrival')?.setValue(parsedDate, { emitEvent: true });
        this.createRouteForm.get('arrival')?.markAsDirty();
      }
    }
  }

  /**
   * Bloqueia a digitação de caracteres que não sejam números ou barras no input.
   */
  protected onlyNumbersAndSlashes(event: KeyboardEvent): boolean {
    const charCode = event.key;
    const allowedCharacters = /^[0-9\/]$/;

    if (!allowedCharacters.test(charCode)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // ==========================================
  // Submissão do Formulário
  // ==========================================
  protected onSubmit(): void {
    const travelId = this.data?.travel?.id;

    if (!travelId) {
      this.messageService.showMessage('Identificador da viagem não encontrado.');
      return;
    }

    if (this.createRouteForm.invalid) {
      this.createRouteForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const rawValues = this.createRouteForm.getRawValue();

    // Formata campos de data caso sejam objetos moment antes do envio
    const payload = {
      ...rawValues,
      departure: rawValues.departure ? moment(rawValues.departure).format('YYYY-MM-DD HH:mm:ss') : null,
      arrival: rawValues.arrival ? moment(rawValues.arrival).format('YYYY-MM-DD HH:mm:ss') : null
    };

    this.travelService.createRoute(travelId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Rota criada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao processar a criação da rota.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}
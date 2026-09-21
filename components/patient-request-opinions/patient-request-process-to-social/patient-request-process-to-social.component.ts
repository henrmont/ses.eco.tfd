import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize, map, startWith } from 'rxjs';

// Material Modules
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services, Models e Interfaces
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';

interface SocialProfessional {
  id: number | string;
  name: string;
  patient_social_requests_count?: number;
  [key: string]: any;
}

@Component({
  selector: 'app-patient-request-process-to-social',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    MatAutocompleteModule,
    MatDialogModule, 
    MatButtonModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatProgressSpinnerModule, 
    MatChipsModule
  ],
  templateUrl: './patient-request-process-to-social.component.html',
  styleUrl: './patient-request-process-to-social.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestProcessToSocialComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly opinionService = inject(PatientRequestOpinionService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestProcessToSocialComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    social_professional_search: [
      { type: 'required', message: 'A escolha de um profissional social é obrigatória.' }
    ]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly socialProfessionalLoading = signal<boolean>(false);
  protected readonly socialProfessionalReadOnly = signal<boolean>(true);

  // ==========================================
  // FormGroups
  // ==========================================
  protected processForm!: FormGroup;

  // ==========================================
  // Autocomplete e Observables
  // ==========================================
  private socialProfessionalOptions: SocialProfessional[] = [];
  protected filteredSocialProfessionalOptions!: Observable<SocialProfessional[]>;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.fetchSocialProfessionals();
    this.registerCleaners();
  }

  // ==========================================
  // Inicialização de Formulário
  // ==========================================
  private initForm(): void {
    this.processForm = this.fb.group({
      social_professional_id: [null, [Validators.required]],
      social_professional_search: [null, [Validators.required]]
    });
  }

  // ==========================================
  // Autocomplete e Filtros
  // ==========================================
  private configureSocialProfessionalFilter(): void {
    const socialCtrl = this.processForm.get('social_professional_search');
    if (socialCtrl) {
      this.filteredSocialProfessionalOptions = socialCtrl.valueChanges.pipe(
        startWith(''),
        map(value => {
          const name = typeof value === 'string' ? value : value?.name;
          return name ? this._filterSocialProfessional(name) : this.socialProfessionalOptions.slice(0, 10);
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private registerCleaners(): void {
    this.processForm.get('social_professional_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.processForm.get('social_professional_id')?.setValue(null);
          this.processForm.get('social_professional_id')?.markAsDirty();
          this.cdr.markForCheck();
        }
      });
  }

  private _filterSocialProfessional(name: string): SocialProfessional[] {
    const filterValue = name.toLowerCase().trim();
    return this.socialProfessionalOptions
      .filter(option => option.name && option.name.toLowerCase().includes(filterValue))
      .slice(0, 10);
  }

  // ==========================================
  // Carregamento de Dados
  // ==========================================
  protected fetchSocialProfessionals(): void {
    this.socialProfessionalLoading.set(true);
    this.cdr.markForCheck();

    this.opinionService.getSocialProfessionals()
      .pipe(
        finalize(() => {
          this.socialProfessionalLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          if (response) {
            this.socialProfessionalOptions = response.map((item: any) => ({
              ...item?.patient,
              ...item
            }));
            this.configureSocialProfessionalFilter();
            this.socialProfessionalReadOnly.set(false);
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.socialProfessionalReadOnly.set(true);
          this.socialProfessionalOptions = [];
          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // Helpers de Exibição e Seleção
  // ==========================================
  protected displaySocialProfessional(socialProfessional: SocialProfessional): string {
    return socialProfessional?.name || '';
  }

  protected setSocialProfessional(option: SocialProfessional): void {
    if (option?.id) {
      this.processForm.get('social_professional_id')?.setValue(option.id);
      this.processForm.get('social_professional_id')?.markAsDirty();
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    if (this.processForm.invalid) {
      this.processForm.markAllAsTouched();
      return;
    }

    const requestId = this.data?.patient_request?.id;
    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    const payload = this.processForm.getRawValue();

    this.opinionService.processPatientRequestToSocial(requestId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Solicitação encaminhada com sucesso!');
          this.dialogRef.close(true);
        },
        error: err => {
          const fallbackError = 'Erro ao tentar encaminhar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}
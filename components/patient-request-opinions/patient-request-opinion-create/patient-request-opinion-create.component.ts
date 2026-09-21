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
import { finalize } from 'rxjs';
import { Editor, NgxEditorModule, Toolbar } from 'ngx-editor';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Services e Models
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';

@Component({
  selector: 'app-patient-request-opinion-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    NgxEditorModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-opinion-create.component.html',
  styleUrl: './patient-request-opinion-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestOpinionCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly opinionService = inject(PatientRequestOpinionService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestOpinionCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    name: [
      { type: 'required', message: 'O título ou nome do parecer é obrigatório.' }
    ],
    content: [
      { type: 'required', message: 'A descrição ou conteúdo do parecer é obrigatório.' }
    ],
    is_approved: [
      { type: 'required', message: 'A definição do status de aprovação é obrigatória.' }
    ]
  };

  // ==========================================
  // Configuração do Editor de Texto Rich Text
  // ==========================================
  protected editor!: Editor;
  protected readonly toolbar: Toolbar = [
    ['bold', 'italic'],
    ['underline', 'strike'],
    ['code', 'blockquote'],
    ['ordered_list', 'bullet_list'],
    [{ heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] }],
    ['link', 'image'],
    ['text_color', 'background_color'],
    ['align_left', 'align_center', 'align_right', 'align_justify'],
    ['horizontal_rule', 'format_clear', 'indent', 'outdent'],
    ['superscript', 'subscript'],
    ['undo', 'redo']
  ];

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // FormGroups
  // ==========================================
  protected opinionForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
    this.initEditor();
  }

  // ==========================================
  // Inicialização de Form e Editor
  // ==========================================
  private initForm(): void {
    this.opinionForm = this.fb.group({
      name: [null, [Validators.required]],
      content: [null, [Validators.required]],
      is_approved: [false, [Validators.required]]
    });
  }

  private initEditor(): void {
    this.editor = new Editor();

    // Liberação segura de memória para evitar vazamento com o ciclo do editor Rich Text
    this.destroyRef.onDestroy(() => {
      this.editor.destroy();
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
          this.opinionForm.disable({ emitEvent: false });
        } else {
          this.opinionForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação inválido.');
      return;
    }

    if (this.opinionForm.invalid) {
      this.opinionForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.opinionService.createOpinion(requestId, this.opinionForm.value)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Parecer criado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao processar a criação do parecer.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Services, Enums & Local Components
import { Professionals } from '../../../enums/professionals';

@Component({
  selector: 'app-professional-types',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatSlideToggleModule,
    ReactiveFormsModule
  ],
  templateUrl: './professional-types.component.html',
  styleUrl: './professional-types.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfessionalTypesComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<{ selectedTypes: string[] }>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ProfessionalTypesComponent>);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected typesForm!: FormGroup;
  protected readonly professionalTypes = signal<string[]>(Object.values(Professionals));

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected toggleType(type: string): void {
    const typesControl = this.typesForm.get('types');
    if (!typesControl) return;

    const currentTypes: string[] = [...(typesControl.value || [])];
    const index = currentTypes.indexOf(type);

    if (index !== -1) {
      currentTypes.splice(index, 1);
    } else {
      currentTypes.push(type);
    }

    this.typesForm.markAsDirty();
    typesControl.setValue(currentTypes);
    typesControl.updateValueAndValidity();
  }

  protected checkType(type: string): boolean {
    const currentTypes: string[] = this.typesForm?.get('types')?.value || [];
    return currentTypes.includes(type);
  }

  protected onConfirm(): void {
    if (this.typesForm.invalid) {
      return;
    }
    const selectedTypes = this.typesForm.get('types')?.value || [];
    this.dialogRef.close(selectedTypes);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const initialTypes = this.data?.selectedTypes || [];

    this.typesForm = this.fb.group({
      types: [initialTypes]
    });
  }
}
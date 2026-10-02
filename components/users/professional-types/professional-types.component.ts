import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Enums & Models
import { Professionals } from '../../../enums/professionals';

type ProfessionalTypesDialogData = {
  selectedTypes?: string[];
};

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
  protected readonly data = inject<ProfessionalTypesDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ProfessionalTypesComponent>);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected typesForm!: FormGroup;
  protected readonly professionalTypes = signal<string[]>(Object.values(Professionals));

  // ==========================================
  // Getters Utilitários
  // ==========================================
  protected get selectedTypes(): string[] {
    return this.typesForm?.get('types')?.value || [];
  }

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

    const currentTypes: string[] = Array.isArray(typesControl.value) ? [...typesControl.value] : [];
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
    return this.selectedTypes.includes(type);
  }

  protected onConfirm(): void {
    if (this.typesForm.invalid) {
      return;
    }

    this.dialogRef.close(this.selectedTypes);
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
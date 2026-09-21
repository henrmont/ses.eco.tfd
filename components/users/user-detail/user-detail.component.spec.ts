import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNgxMask } from 'ngx-mask';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShowUserComponent } from './show-user-component';

describe('ShowUserComponent (Vitest)', () => {
  let component: ShowUserComponent;
  let fixture: ComponentFixture<ShowUserComponent>;
  let mockDialogRef: any;

  const mockDialogData = {
    user: {
      id: 1,
      email: 'medico.tfd@email.com',
      professional: {
        name: 'Dr. Alberto Roberto',
        type: 'MEDICO',
        cns: '123456789012345',
        registration: '999888',
        professional_register: 'CRM-MT 456',
        cbo: '225125'
      }
    }
  };

  beforeEach(async () => {
    mockDialogRef = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ShowUserComponent],
      providers: [
        provideNgxMask(), // Evita o erro de token do ngx-mask config
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: MatDialogRef, useValue: mockDialogRef }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShowUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente de visualização com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('deve injetar e disponibilizar os dados do MAT_DIALOG_DATA no template', () => {
    expect(component.data).toBeTruthy();
    expect(component.data.user.email).toBe('medico.tfd@email.com');
    expect(component.data.user.professional.name).toBe('Dr. Alberto Roberto');
  });

  it('deve renderizar os dados do usuário corretamente no DOM', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    
    // Verifica se os textos cruciais foram renderizados na tela
    expect(compiled.textContent).toContain('Dr. Alberto Roberto');
    expect(compiled.textContent).toContain('medico.tfd@email.com');
    expect(compiled.textContent).toContain('CRM-MT 456');
    expect(compiled.textContent).toContain('225125');
  });
});
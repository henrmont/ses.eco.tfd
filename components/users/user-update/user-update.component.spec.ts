import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ANIMATION_MODULE_TYPE } from '@angular/platform-browser';
import { provideNgxMask } from 'ngx-mask'; // 🌟 Importação adicionada aqui
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UpdateUserComponent } from './update-user-component';
import { UserService } from '../../../services/user-service';
import { MessageService } from '../../../../core/services/message-service';
import { Professionals } from '../../../enums/professionals';

describe('UpdateUserComponent (Vitest)', () => {
  let component: UpdateUserComponent;
  let fixture: ComponentFixture<UpdateUserComponent>;
  
  let mockUserService: any;
  let mockMessageService: any;
  let mockDialogRef: any;

  const mockDialogData = {
    user: {
      id: 1,
      email: 'joao.medico@email.com',
      professional: {
        name: 'João da Silva',
        type: Professionals.MEDICO,
        cns: '123456789012345',
        registration: '654321',
        professional_register: 'CRM123',
        cbo: '225125'
      }
    }
  };

  beforeEach(async () => {
    mockUserService = {
      updateUser: vi.fn(),
      cnsUserExistsValidator: vi.fn().mockReturnValue(() => of(null))
    };

    mockMessageService = {
      showMessage: vi.fn()
    };

    mockDialogRef = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdateUserComponent,
        ReactiveFormsModule,
      ],
      providers: [
        provideNgxMask(), // 🌟 Resolve o erro do InjectionToken da máscara
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: UserService, useValue: mockUserService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: MatDialogRef, useValue: mockDialogRef }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('deve inicializar o formulário com os dados recebidos via MAT_DIALOG_DATA', () => {
    const formValues = component.updateUserForm.value;
    expect(formValues.email).toBe(mockDialogData.user.email);
    expect(formValues.name).toBe(mockDialogData.user.professional.name);
    expect(formValues.type).toBe(mockDialogData.user.professional.type);
    expect(formValues.cns).toBe(mockDialogData.user.professional.cns);
    expect(formValues.registration).toBe(mockDialogData.user.professional.registration);
  });

  it('deve manter o formulário no estado "pristine" logo após a inicialização', () => {
    expect(component.updateUserForm.pristine).toBe(true);
  });

  it('deve habilitar CBO e Registro Profissional se o tipo inicial for MÉDICO', () => {
    const cboControl = component.updateUserForm.get('cbo');
    const registerControl = component.updateUserForm.get('professional_register');

    expect(cboControl?.enabled).toBe(true);
    expect(registerControl?.enabled).toBe(true);
  });

  it('deve desabilitar e resetar o CBO se o tipo for alterado para ASSISTENTE_SOCIAL', () => {
    component.onSelection({ value: Professionals.ASSISTENTE_SOCIAL } as any);

    const cboControl = component.updateUserForm.get('cbo');
    const registerControl = component.updateUserForm.get('professional_register');

    expect(cboControl?.disabled).toBe(true);
    expect(cboControl?.value).toBeNull();
    expect(registerControl?.enabled).toBe(true);
  });

  it('deve desabilitar e limpar ambos os campos se o tipo for alterado para um profissional sem conselho', () => {
    component.onSelection({ value: 'OUTRO_TIPO' } as any);

    const cboControl = component.updateUserForm.get('cbo');
    const registerControl = component.updateUserForm.get('professional_register');

    expect(cboControl?.disabled).toBe(true);
    expect(registerControl?.disabled).toBe(true);
    expect(cboControl?.value).toBeNull();
    expect(registerControl?.value).toBeNull();
  });

  it('deve chamar o UserService ao submeter um formulário modificado e válido', () => {
    mockUserService.updateUser.mockReturnValue(of({ message: 'Sucesso' }));
    
    component.updateUserForm.get('name')?.setValue('João Alterado da Silva');
    component.updateUserForm.get('name')?.markAsDirty();

    component.onSubmit();

    // 🌟 CORREÇÃO: Alterado de vi.any(Object) para expect.any(Object)
    expect(mockUserService.updateUser).toHaveBeenCalledWith(mockDialogData.user.id, expect.any(Object));
    expect(mockMessageService.showMessage).toHaveBeenCalledWith('Sucesso');
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('não deve submeter o formulário caso ele se torne inválido', () => {
    component.updateUserForm.get('name')?.setValue('');

    component.onSubmit();

    expect(mockUserService.updateUser).not.toHaveBeenCalled();
  });
});
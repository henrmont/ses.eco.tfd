// src/app/tfd/components/users/user-create/user-create.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserCreateComponent } from './user-create.component';
import { MessageService } from '../../../../core/services/message.service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { Professionals } from '../../../enums/professionals';
import { UserService } from '../../../services/user.service';
import { ProfessionalTypesComponent } from '../professional-types/professional-types.component';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('UserCreateComponent', () => {
  let component: UserCreateComponent;
  let fixture: ComponentFixture<UserCreateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let userServiceMock: {
    createUser: ReturnType<typeof vi.fn>;
    emailUserExistsValidator: ReturnType<typeof vi.fn>;
    cnsUserExistsValidator: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const validPayload = {
    name: 'Maria Silva',
    email: 'maria.silva@saude.gov.br',
    types: [Professionals.MEDICO],
    cns: '123456789012345',
    registration: '123456',
    professional_register: 'CRM-MT 1234',
    cbo: '225125',
  };

  function fillValidForm(overrides: Partial<typeof validPayload> = {}): void {
    const data = { ...validPayload, ...overrides };
    const controls = component['userForm'].controls;

    controls.types.setValue(data.types);
    controls.name.setValue(data.name);
    controls.email.setValue(data.email);
    controls.cns.setValue(data.cns);
    controls.registration.setValue(data.registration);

    if (controls.professional_register.enabled) {
      controls.professional_register.setValue(data.professional_register);
    }
    if (controls.cbo.enabled) {
      controls.cbo.setValue(data.cbo);
    }
  }

  beforeEach(async () => {
    broadcastChannelMock = new MockBroadcastChannel();

    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return broadcastChannelMock;
      })
    );

    vi.spyOn(CustomValidators, 'cnsValidator').mockReturnValue(() => null);

    userServiceMock = {
      createUser: vi.fn(),
      emailUserExistsValidator: vi.fn(() => () => of(null)),
      cnsUserExistsValidator: vi.fn(() => () => of(null)),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UserCreateComponent],
      providers: [
        { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
        { provide: UserService, useValue: userServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
      ],
    })
      .overrideComponent(UserCreateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e iniciar isSubmitting como false', () => {
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-users-channel');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Inicialização e Validações do Formulário', () => {
    it('deve inicializar o formulário com valores padrão e campos profissionais desabilitados', () => {
      const form = component['userForm'];

      expect(form.controls.name.value).toBe('');
      expect(form.controls.email.value).toBe('');
      expect(form.controls.types.value).toEqual([]);
      expect(form.controls.cns.value).toBe('');
      expect(form.controls.registration.value).toBe('');
      expect(form.controls.professional_register.disabled).toBe(true);
      expect(form.controls.cbo.disabled).toBe(true);
      expect(form.invalid).toBe(true);
    });

    it('deve validar tamanho mínimo (5) e máximo (6) da matrícula', () => {
      const registrationCtrl = component['userForm'].controls.registration;

      registrationCtrl.setValue('1234');
      expect(registrationCtrl.hasError('minlength')).toBe(true);

      registrationCtrl.setValue('12345');
      expect(registrationCtrl.valid).toBe(true);

      registrationCtrl.setValue('1234567');
      expect(registrationCtrl.hasError('maxlength')).toBe(true);
    });

    it('deve refletir erro assíncrono emailExists quando o validador retornar erro', () => {
      userServiceMock.emailUserExistsValidator.mockReturnValueOnce(() =>
        of({ emailExists: true })
      );

      fixture = TestBed.createComponent(UserCreateComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const emailCtrl = component['userForm'].controls.email;
      emailCtrl.setValue('duplicado@saude.gov.br');
      fixture.detectChanges();

      expect(emailCtrl.hasError('emailExists')).toBe(true);
    });

    it('deve refletir erro assíncrono cnsExists quando o validador retornar erro', () => {
      userServiceMock.cnsUserExistsValidator.mockReturnValueOnce(() =>
        of({ cnsExists: true })
      );

      fixture = TestBed.createComponent(UserCreateComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const cnsCtrl = component['userForm'].controls.cns;
      cnsCtrl.setValue('123456789012345');
      fixture.detectChanges();

      expect(cnsCtrl.hasError('cnsExists')).toBe(true);
    });
  });

  describe('Regras Dinâmicas por Tipo de Profissional', () => {
    it('deve habilitar e exigir professional_register e cbo quando o tipo for MEDICO', () => {
      const typesCtrl = component['userForm'].controls.types;
      const profRegCtrl = component['userForm'].controls.professional_register;
      const cboCtrl = component['userForm'].controls.cbo;

      typesCtrl.setValue([Professionals.MEDICO]);

      expect(profRegCtrl.enabled).toBe(true);
      expect(profRegCtrl.hasError('required')).toBe(true);
      expect(cboCtrl.enabled).toBe(true);
      expect(cboCtrl.hasError('required')).toBe(true);
    });

    it('deve habilitar e exigir apenas professional_register quando o tipo for ASSISTENTE_SOCIAL', () => {
      const typesCtrl = component['userForm'].controls.types;
      const profRegCtrl = component['userForm'].controls.professional_register;
      const cboCtrl = component['userForm'].controls.cbo;

      typesCtrl.setValue([Professionals.ASSISTENTE_SOCIAL]);

      expect(profRegCtrl.enabled).toBe(true);
      expect(profRegCtrl.hasError('required')).toBe(true);
      expect(cboCtrl.disabled).toBe(true);
      expect(cboCtrl.value).toBe('');
    });

    it('deve desabilitar e limpar professional_register e cbo ao remover MEDICO e ASSISTENTE_SOCIAL', () => {
      const typesCtrl = component['userForm'].controls.types;
      const profRegCtrl = component['userForm'].controls.professional_register;
      const cboCtrl = component['userForm'].controls.cbo;

      typesCtrl.setValue([Professionals.MEDICO]);
      profRegCtrl.setValue('CRM-MT 999');
      cboCtrl.setValue('225125');

      typesCtrl.setValue(['OUTRO_PERFIL']);

      expect(profRegCtrl.disabled).toBe(true);
      expect(profRegCtrl.value).toBe('');
      expect(cboCtrl.disabled).toBe(true);
      expect(cboCtrl.value).toBe('');
    });
  });

  describe('Modal de Tipos de Profissional (openProfessionalTypesDialog)', () => {
    it('deve abrir o dialog com os tipos selecionados atuais e atualizar types ao confirmar', () => {
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
        afterClosed: () => of([Professionals.MEDICO]),
      } as unknown as ReturnType<MatDialog['open']>);

      component['userForm'].controls.types.setValue([Professionals.ASSISTENTE_SOCIAL]);

      component['openProfessionalTypesDialog']();

      expect(openSpy).toHaveBeenCalledWith(
        ProfessionalTypesComponent,
        expect.objectContaining({
          width: '600px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          data: { selectedTypes: [Professionals.ASSISTENTE_SOCIAL] },
        })
      );
      expect(component['userForm'].controls.types.value).toEqual([Professionals.MEDICO]);
      expect(component['userForm'].controls.types.touched).toBe(true);
    });

    it('não deve alterar types quando o dialog for fechado sem retorno (undefined)', () => {
      vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
        afterClosed: () => of(undefined),
      } as unknown as ReturnType<MatDialog['open']>);

      component['userForm'].controls.types.setValue([Professionals.MEDICO]);

      component['openProfessionalTypesDialog']();

      expect(component['userForm'].controls.types.value).toEqual([Professionals.MEDICO]);
      expect(component['userForm'].controls.types.touched).toBe(false);
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('não deve enviar a requisição se o formulário estiver inválido e deve marcar campos como tocados', () => {
      component['onSubmit']();

      expect(userServiceMock.createUser).not.toHaveBeenCalled();
      expect(component['userForm'].controls.name.touched).toBe(true);
      expect(component['userForm'].controls.email.touched).toBe(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve criar o usuário com sucesso, notificar o BroadcastChannel, exibir mensagem e fechar o dialog', () => {
      fillValidForm();
      userServiceMock.createUser.mockReturnValue(
        of({ message: 'Usuário criado com sucesso!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(userServiceMock.createUser).toHaveBeenCalledWith(validPayload);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Usuário criado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['userForm'].disabled).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      fillValidForm();
      userServiceMock.createUser.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Usuário cadastrado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir a mensagem de erro retornada pelo backend e reverter o estado do formulário', () => {
      fillValidForm({ types: [Professionals.ASSISTENTE_SOCIAL], cbo: '' });
      userServiceMock.createUser.mockReturnValue(
        throwError(() => ({ error: { message: 'Matrícula já cadastrada.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Matrícula já cadastrada.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['userForm'].disabled).toBe(false);
      expect(component['userForm'].controls.cbo.disabled).toBe(true);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      fillValidForm();
      userServiceMock.createUser.mockReturnValue(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao criar o usuário.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});
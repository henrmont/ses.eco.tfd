// src/app/tfd/components/users/user-update/user-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserUpdateComponent } from './user-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { Professionals } from '../../../enums/professionals';
import { TfdUser as User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { ProfessionalTypesComponent } from '../professional-types/professional-types.component';

interface UserUpdateDialogData {
  user?: User;
}

describe('UserUpdateComponent', () => {
  let component: UserUpdateComponent;
  let fixture: ComponentFixture<UserUpdateComponent>;

  let userServiceMock: {
    updateUser: ReturnType<typeof vi.fn>;
    cnsUserExistsValidator: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseUser: User = {
    id: 55,
    name: 'Mariana Costa',
    email: 'mariana.costa@saude.gov.br',
    professional: {
      name: 'Dra. Mariana Costa',
      types: [Professionals.MEDICO],
      cns: '700000000000001',
      registration: '654321',
      professional_register: 'CRM-MT 5555',
      cbo: '225125',
    },
  } as unknown as User;

  async function createComponent(dialogData: UserUpdateDialogData | null): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [UserUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: UserService, useValue: userServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(UserUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.spyOn(CustomValidators, 'cnsValidator').mockReturnValue(() => null);

    userServiceMock = {
      updateUser: vi.fn(),
      cnsUserExistsValidator: vi.fn(() => () => of(null)),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent({
      user: {
        ...baseUser,
        professional: { ...baseUser.professional },
      } as unknown as User,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente e iniciar isSubmitting como false', () => {
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
  });

  describe('Inicialização do Formulário', () => {
    it('deve preencher os campos com os dados de MAT_DIALOG_DATA e manter email desabilitado', () => {
      const form = component['userForm'];

      expect(form.controls.name.value).toBe('Dra. Mariana Costa');
      expect(form.controls.email.value).toBe('mariana.costa@saude.gov.br');
      expect(form.controls.email.disabled).toBe(true);
      expect(form.controls.types.value).toEqual([Professionals.MEDICO]);
      expect(form.controls.cns.value).toBe('700000000000001');
      expect(form.controls.registration.value).toBe('654321');
      expect(form.controls.professional_register.enabled).toBe(true);
      expect(form.controls.professional_register.value).toBe('CRM-MT 5555');
      expect(form.controls.cbo.enabled).toBe(true);
      expect(form.controls.cbo.value).toBe('225125');
      expect(userServiceMock.cnsUserExistsValidator).toHaveBeenCalledWith('700000000000001');
      expect(form.valid).toBe(true);
    });

    it('deve usar user.name como fallback e passar null ao cnsUserExistsValidator quando cns estiver vazio', async () => {
      await createComponent({
        user: {
          id: 56,
          name: 'Usuário Sem CNS',
          email: 'sem.cns@saude.gov.br',
          professional: {
            types: ['MEDICO', { type: 'ASSISTENTE_SOCIAL' }],
          },
        } as unknown as User,
      });

      const form = component['userForm'];
      expect(form.controls.name.value).toBe('Usuário Sem CNS');
      expect(form.controls.types.value).toEqual(['MEDICO', 'ASSISTENTE_SOCIAL']);
      expect(userServiceMock.cnsUserExistsValidator).toHaveBeenCalledWith(null);
    });

    it('deve inicializar formulário vazio e desabilitar campos profissionais quando não houver dados', async () => {
      await createComponent(null);

      const form = component['userForm'];
      expect(form.controls.name.value).toBe('');
      expect(form.controls.email.value).toBe('');
      expect(form.controls.email.disabled).toBe(true);
      expect(form.controls.types.value).toEqual([]);
      expect(form.controls.professional_register.disabled).toBe(true);
      expect(form.controls.cbo.disabled).toBe(true);
      expect(form.invalid).toBe(true);
    });
  });

  describe('Regras Dinâmicas por Tipo de Profissional', () => {
    it('deve habilitar e exigir apenas professional_register quando o tipo for ASSISTENTE_SOCIAL', () => {
      const typesCtrl = component['userForm'].controls.types;
      const profRegCtrl = component['userForm'].controls.professional_register;
      const cboCtrl = component['userForm'].controls.cbo;

      typesCtrl.setValue([Professionals.ASSISTENTE_SOCIAL]);

      expect(profRegCtrl.enabled).toBe(true);
      expect(cboCtrl.disabled).toBe(true);
      expect(cboCtrl.value).toBe('');
    });

    it('deve desabilitar e limpar professional_register e cbo quando nenhum perfil exigido estiver selecionado', () => {
      const typesCtrl = component['userForm'].controls.types;
      const profRegCtrl = component['userForm'].controls.professional_register;
      const cboCtrl = component['userForm'].controls.cbo;

      typesCtrl.setValue(['ADMINISTRATIVO']);

      expect(profRegCtrl.disabled).toBe(true);
      expect(profRegCtrl.value).toBe('');
      expect(cboCtrl.disabled).toBe(true);
      expect(cboCtrl.value).toBe('');
    });
  });

  describe('Modal de Tipos de Profissional (openProfessionalTypesDialog)', () => {
    it('deve abrir o dialog com os tipos atuais e atualizar types marcando touched e dirty ao confirmar', () => {
      const openSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
        afterClosed: () => of([Professionals.ASSISTENTE_SOCIAL]),
      } as unknown as ReturnType<MatDialog['open']>);

      component['openProfessionalTypesDialog']();

      expect(openSpy).toHaveBeenCalledWith(
        ProfessionalTypesComponent,
        expect.objectContaining({
          width: '600px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          data: { selectedTypes: [Professionals.MEDICO] },
        })
      );
      expect(component['userForm'].controls.types.value).toEqual([
        Professionals.ASSISTENTE_SOCIAL,
      ]);
      expect(component['userForm'].controls.types.touched).toBe(true);
      expect(component['userForm'].controls.types.dirty).toBe(true);
      expect(component['userForm'].dirty).toBe(true);
    });

    it('não deve alterar types nem marcar dirty quando o dialog for fechado com undefined', () => {
      vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
        afterClosed: () => of(undefined),
      } as unknown as ReturnType<MatDialog['open']>);

      component['openProfessionalTypesDialog']();

      expect(component['userForm'].controls.types.value).toEqual([Professionals.MEDICO]);
      expect(component['userForm'].controls.types.touched).toBe(false);
      expect(component['userForm'].controls.types.dirty).toBe(false);
      expect(component['userForm'].dirty).toBe(false);
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('deve exibir mensagem de erro e não chamar o serviço se userId estiver ausente', async () => {
      await createComponent({ user: undefined });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do usuário inválido.'
      );
      expect(userServiceMock.updateUser).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('não deve enviar a requisição se o formulário estiver inválido e deve marcar campos como tocados', () => {
      component['userForm'].controls.name.setValue('');

      component['onSubmit']();

      expect(userServiceMock.updateUser).not.toHaveBeenCalled();
      expect(component['userForm'].controls.name.touched).toBe(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve atualizar o usuário com sucesso, exibir mensagem, fechar o dialog e manter email desabilitado', () => {
      component['userForm'].controls.name.setValue('Dra. Mariana Costa Atualizada');
      userServiceMock.updateUser.mockReturnValue(
        of({ message: 'Usuário atualizado com sucesso!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(userServiceMock.updateUser).toHaveBeenCalledWith(55, {
        name: 'Dra. Mariana Costa Atualizada',
        email: 'mariana.costa@saude.gov.br',
        types: [Professionals.MEDICO],
        cns: '700000000000001',
        registration: '654321',
        professional_register: 'CRM-MT 5555',
        cbo: '225125',
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Usuário atualizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['userForm'].controls.email.disabled).toBe(true);
      expect(component['userForm'].controls.name.enabled).toBe(true);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      userServiceMock.updateUser.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Usuário atualizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro retornada pelo backend e reverter o estado do formulário', () => {
      userServiceMock.updateUser.mockReturnValue(
        throwError(() => ({ error: { message: 'CNS já cadastrado para outro usuário.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'CNS já cadastrado para outro usuário.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['userForm'].controls.email.disabled).toBe(true);
      expect(component['userForm'].controls.name.enabled).toBe(true);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      userServiceMock.updateUser.mockReturnValue(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao atualizar o usuário.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});
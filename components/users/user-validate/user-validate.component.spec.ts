// src/app/tfd/components/users/user-validate/user-validate.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserValidateComponent, UserValidateDialogData } from './user-validate.component';
import { MessageService } from '../../../../core/services/message.service';
import { TfdUser as User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';

describe('UserValidateComponent', () => {
  let component: UserValidateComponent;
  let fixture: ComponentFixture<UserValidateComponent>;

  let userServiceMock: {
    validateUser: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: UserValidateDialogData | null;

  const baseUser: User = {
    id: 38,
    name: 'Rafael Oliveira',
    professional: {
      name: 'Dr. Rafael Oliveira',
    },
    module: {
      pivot: {
        is_valid: true,
      },
    },
  } as unknown as User;

  async function createComponent(dialogData: UserValidateDialogData | null): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [UserValidateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: UserService, useValue: userServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(UserValidateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserValidateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    userServiceMock = {
      validateUser: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent({ user: { ...baseUser } });
  });

  it('deve criar o componente e iniciar isSubmitting como false', () => {
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
  });

  describe('Getter isValid', () => {
    it('deve retornar true quando module.pivot.is_valid for verdadeiro', () => {
      expect(component['isValid']).toBe(true);
    });

    it('deve retornar false quando is_valid for falso ou estrutura estiver ausente', async () => {
      await createComponent({
        user: { id: 38, module: { pivot: { is_valid: false } } } as unknown as User,
      });
      expect(component['isValid']).toBe(false);

      await createComponent({ user: { id: 38 } as unknown as User });
      expect(component['isValid']).toBe(false);

      await createComponent(null);
      expect(component['isValid']).toBe(false);
    });
  });

  describe('Getter userName', () => {
    it('deve priorizar professional.name quando disponível', () => {
      expect(component['userName']).toBe('Dr. Rafael Oliveira');
    });

    it('deve usar user.name quando professional.name não estiver disponível', async () => {
      await createComponent({
        user: { id: 38, name: 'Rafael Oliveira' } as unknown as User,
      });

      expect(component['userName']).toBe('Rafael Oliveira');
    });

    it('deve retornar "Usuário" quando não houver nome disponível', async () => {
      await createComponent({ user: { id: 38 } as unknown as User });
      expect(component['userName']).toBe('Usuário');

      await createComponent(null);
      expect(component['userName']).toBe('Usuário');
    });
  });

  describe('Alteração de Validação (onSubmit)', () => {
    it('deve exibir mensagem de erro e não chamar o serviço quando userId estiver ausente', async () => {
      await createComponent({ user: undefined });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do usuário inválido.'
      );
      expect(userServiceMock.validateUser).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve alterar a validação com sucesso, exibir mensagem da resposta e fechar o dialog com true', () => {
      userServiceMock.validateUser.mockReturnValue(
        of({ message: 'Usuário validado com sucesso!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(userServiceMock.validateUser).toHaveBeenCalledWith(38);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Usuário validado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      userServiceMock.validateUser.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Status do usuário atualizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de erro retornada pelo backend e reverter isSubmitting', () => {
      userServiceMock.validateUser.mockReturnValue(
        throwError(() => ({ error: { message: 'Cadastro incompleto para validação.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Cadastro incompleto para validação.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      userServiceMock.validateUser.mockReturnValue(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar alterar a validação do usuário.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});
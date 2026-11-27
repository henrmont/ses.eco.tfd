// src/app/tfd/components/users/user-lock/user-lock.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserLockComponent, UserLockDialogData } from './user-lock.component';
import { MessageService } from '../../../../core/services/message.service';
import { TfdUser as User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';

describe('UserLockComponent', () => {
  let component: UserLockComponent;
  let fixture: ComponentFixture<UserLockComponent>;

  let userServiceMock: {
    lockUser: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: UserLockDialogData | null;

  const baseUser: User = {
    id: 27,
    name: 'Fernanda Lima',
    professional: {
      name: 'Dra. Fernanda Lima',
    },
    module: {
      pivot: {
        is_editable: true,
      },
    },
  } as unknown as User;

  async function createComponent(dialogData: UserLockDialogData | null): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [UserLockComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: UserService, useValue: userServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(UserLockComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserLockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    userServiceMock = {
      lockUser: vi.fn(),
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

  describe('Getter isEditable', () => {
    it('deve retornar true quando module.pivot.is_editable for verdadeiro', () => {
      expect(component['isEditable']).toBe(true);
    });

    it('deve retornar false quando is_editable for falso ou estrutura estiver ausente', async () => {
      await createComponent({
        user: { id: 27, module: { pivot: { is_editable: false } } } as unknown as User,
      });
      expect(component['isEditable']).toBe(false);

      await createComponent({ user: { id: 27 } as unknown as User });
      expect(component['isEditable']).toBe(false);

      await createComponent(null);
      expect(component['isEditable']).toBe(false);
    });
  });

  describe('Getter userName', () => {
    it('deve priorizar professional.name quando disponível', () => {
      expect(component['userName']).toBe('Dra. Fernanda Lima');
    });

    it('deve usar user.name quando professional.name não estiver disponível', async () => {
      await createComponent({
        user: { id: 27, name: 'Fernanda Lima' } as unknown as User,
      });

      expect(component['userName']).toBe('Fernanda Lima');
    });

    it('deve retornar "Usuário" quando não houver nome disponível', async () => {
      await createComponent({ user: { id: 27 } as unknown as User });
      expect(component['userName']).toBe('Usuário');

      await createComponent(null);
      expect(component['userName']).toBe('Usuário');
    });
  });

  describe('Alteração de Status (onSubmit)', () => {
    it('deve exibir mensagem de erro e não chamar o serviço quando userId estiver ausente', async () => {
      await createComponent({ user: undefined });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do usuário inválido.'
      );
      expect(userServiceMock.lockUser).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve alterar o status com sucesso, exibir mensagem da resposta e fechar o dialog com true', () => {
      userServiceMock.lockUser.mockReturnValue(
        of({ message: 'Usuário bloqueado com sucesso!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(userServiceMock.lockUser).toHaveBeenCalledWith(27);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Usuário bloqueado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      userServiceMock.lockUser.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Status do usuário atualizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de erro retornada pelo backend e reverter isSubmitting', () => {
      userServiceMock.lockUser.mockReturnValue(
        throwError(() => ({ error: { message: 'Sem permissão para alterar status.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Sem permissão para alterar status.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      userServiceMock.lockUser.mockReturnValue(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar alterar o status do usuário.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});
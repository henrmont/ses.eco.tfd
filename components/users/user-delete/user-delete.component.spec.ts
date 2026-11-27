// src/app/tfd/components/users/user-delete/user-delete.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserDeleteComponent, UserDeleteDialogData } from './user-delete.component';
import { MessageService } from '../../../../core/services/message.service';
import { TfdUser as User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';

describe('UserDeleteComponent', () => {
  let component: UserDeleteComponent;
  let fixture: ComponentFixture<UserDeleteComponent>;

  let userServiceMock: {
    deleteUser: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: UserDeleteDialogData | null;

  const baseUser: User = {
    id: 42,
    name: 'Carlos Souza',
    professional: {
      name: 'Dr. Carlos Souza',
    },
  } as User;

  async function createComponent(dialogData: UserDeleteDialogData | null): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [UserDeleteComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: UserService, useValue: userServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(UserDeleteComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserDeleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    userServiceMock = {
      deleteUser: vi.fn(),
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

  describe('Getter userName', () => {
    it('deve priorizar professional.name quando disponível', async () => {
      await createComponent({
        user: {
          id: 42,
          name: 'Carlos Souza',
          professional: { name: 'Dr. Carlos Souza' },
        } as User,
      });

      expect(component['userName']).toBe('Dr. Carlos Souza');
    });

    it('deve usar user.name quando professional.name não estiver disponível', async () => {
      await createComponent({
        user: {
          id: 42,
          name: 'Carlos Souza',
        } as User,
      });

      expect(component['userName']).toBe('Carlos Souza');
    });

    it('deve retornar "Usuário" quando não houver nome em user ou professional', async () => {
      await createComponent({ user: { id: 42 } as User });
      expect(component['userName']).toBe('Usuário');

      await createComponent(null);
      expect(component['userName']).toBe('Usuário');
    });
  });

  describe('Submissão da Remoção (onSubmit)', () => {
    it('deve exibir mensagem de erro e não chamar o serviço quando userId estiver ausente', async () => {
      await createComponent({ user: undefined });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do usuário inválido.'
      );
      expect(userServiceMock.deleteUser).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve remover o usuário com sucesso, exibir mensagem da resposta e fechar o dialog com true', () => {
      userServiceMock.deleteUser.mockReturnValue(
        of({ message: 'Usuário excluído!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(userServiceMock.deleteUser).toHaveBeenCalledWith(42);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Usuário excluído!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      userServiceMock.deleteUser.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Usuário removido com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de erro retornada pelo backend e reverter isSubmitting', () => {
      userServiceMock.deleteUser.mockReturnValue(
        throwError(() => ({ error: { message: 'Usuário possui vínculos ativos.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Usuário possui vínculos ativos.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      userServiceMock.deleteUser.mockReturnValue(
        throwError(() => new Error('Falha inesperada'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar remover o usuário.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});
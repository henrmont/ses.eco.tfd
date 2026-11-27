// src/app/tfd/components/roles/role-delete/role-delete.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleDeleteComponent, RoleDeleteDialogData } from './role-delete.component';
import { Role } from '../../../../core/models/role.model';
import { MessageService } from '../../../../core/services/message.service';
import { RoleService } from '../../../services/role.service';

describe('RoleDeleteComponent', () => {
  let component: RoleDeleteComponent;
  let fixture: ComponentFixture<RoleDeleteComponent>;

  let roleServiceMock: {
    deleteRole: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: RoleDeleteDialogData | null;

  const baseRole: Role = {
    id: 12,
    name: 'tfd/roles/gestor',
  } as Role;

  async function createComponent(dialogData: RoleDeleteDialogData | null): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [RoleDeleteComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: RoleService, useValue: roleServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(RoleDeleteComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RoleDeleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    roleServiceMock = {
      deleteRole: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent({ role: { ...baseRole } });
  });

  it('deve criar o componente e iniciar isSubmitting como false', () => {
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
  });

  describe('Getter roleName e formatRoleName', () => {
    it('deve extrair o último segmento após "/" em roleName', () => {
      expect(component['roleName']).toBe('gestor');
    });

    it('deve retornar "Regra" em roleName quando role ou name estiver ausente', async () => {
      await createComponent({ role: { id: 12, name: '' } as Role });
      expect(component['roleName']).toBe('Regra');

      await createComponent({ role: undefined });
      expect(component['roleName']).toBe('Regra');

      await createComponent(null);
      expect(component['roleName']).toBe('Regra');
    });

    it('deve formatar o nome em formatRoleName e retornar string vazia quando ausente', () => {
      expect(component['formatRoleName']('tfd/roles/auditor')).toBe('auditor');
      expect(component['formatRoleName']('simples')).toBe('simples');
      expect(component['formatRoleName']('')).toBe('');
      expect(component['formatRoleName'](undefined)).toBe('');
    });
  });

  describe('Submissão da Remoção (onSubmit)', () => {
    it('deve exibir mensagem de erro e não chamar o serviço quando roleId estiver ausente', async () => {
      await createComponent({ role: undefined });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da regra inválido.'
      );
      expect(roleServiceMock.deleteRole).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve remover a regra com sucesso, exibir mensagem da resposta e fechar o dialog com true', () => {
      roleServiceMock.deleteRole.mockReturnValue(
        of({ message: 'Regra excluída com sucesso!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(roleServiceMock.deleteRole).toHaveBeenCalledWith(12);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Regra excluída com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      roleServiceMock.deleteRole.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Regra removida com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve manter isSubmitting true durante requisição pendente e reverter ao concluir', () => {
      const pending$ = new Subject<{ message?: string }>();
      roleServiceMock.deleteRole.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);

      pending$.next({ message: 'Removida' });
      pending$.complete();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de erro retornada pelo backend e reverter isSubmitting', () => {
      roleServiceMock.deleteRole.mockReturnValue(
        throwError(() => ({ error: { message: 'Regra em uso por usuários.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Regra em uso por usuários.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      roleServiceMock.deleteRole.mockReturnValue(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar remover a regra.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});
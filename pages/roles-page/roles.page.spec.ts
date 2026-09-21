import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RoleService } from '../../services/role-service';
import { Role } from '../../models/role';

// 1. Mock do BroadcastChannel Global para o canal de Roles
const broadcastChannelMock = {
  postMessage: vi.fn(),
  close: vi.fn()
};

let canalCallback: any = null;

vi.stubGlobal('BroadcastChannel', class {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  set onmessage(callback: any) {
    canalCallback = callback;
  }
  get onmessage() {
    return canalCallback;
  }
  postMessage(message: any) {
    broadcastChannelMock.postMessage(message);
    if (canalCallback) {
      canalCallback({ data: message });
    }
  }
  close() {
    broadcastChannelMock.close();
  }
});

describe('RolesPage', () => {
  let component: any;
  let fixture: ComponentFixture<any>;

  let roleServiceMock: any;
  let dialogMock: any;
  let activatedRouteMock: any;
  let dialogRefMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    canalCallback = null;

    // Garantia de instâncias limpas do mock do serviço por teste
    roleServiceMock = {
      getRoles: vi.fn().mockImplementation(() => of([]))
    };

    dialogRefMock = {
      close: vi.fn(),
      afterClosed: vi.fn().mockReturnValue(of(true))
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    // Mock do usuário logado contendo uma role com permissão específica
    activatedRouteMock = {
      parent: {
        parent: {
          snapshot: {
            data: {
              user: {
                id: 1,
                roles: [
                  { name: 'Administrador', permissions: [{ name: 'tfd/role deletar' }] }
                ]
              }
            }
          }
        }
      }
    };

    // Dynamic Import para evitar problemas com hoisting do Vitest
    const { RolesPage } = await import('./roles-page');

    await TestBed.configureTestingModule({
      imports: [RolesPage],
      providers: [
        { provide: RoleService, useValue: roleServiceMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RolesPage);
    component = fixture.componentInstance;
  });

  // Teardown crucial para o takeUntilDestroyed() não vazar memória no Zone.js
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('deve carregar as roles com sucesso e fechar o loading dialog', () => {
    const mockRoles: Role[] = [
      { id: 1, name: 'Administrador', permissions: [] },
      { id: 2, name: 'Operador', permissions: [] }
    ];
    roleServiceMock.getRoles.mockImplementation(() => of(mockRoles));

    fixture.detectChanges();

    expect(dialogMock.open).toHaveBeenCalled();
    expect(dialogRefMock.close).toHaveBeenCalled();
    expect(component['rolesList']()).toEqual(mockRoles);
  });

  it('deve filtrar as roles transformando o termo para lowercase e removendo espaços', () => {
    fixture.detectChanges();
    
    component['rolesList'].set([
      { id: '1', name: 'Administrador' },
      { id: '2', name: 'Atendente' }
    ]);
    fixture.detectChanges();

    const mockEvent = { target: { value: '  ATENDENTE   ' } } as unknown as Event;
    component['applyFilter'](mockEvent);

    expect(component['dataSource']().filter).toBe('atendente');
  });

  it('deve validar permissões usando o checkPermissions', () => {
    fixture.detectChanges();

    // Como o usuário logado TEM 'tfd/role deletar', checkPermissions deve retornar FALSE (nega o bloqueio)
    expect(component['checkPermissions']('tfd/role deletar')).toBe(false);
    // Como NÃO TEM 'tfd/role criar', checkPermissions deve retornar TRUE (indica que deve bloquear)
    expect(component['checkPermissions']('tfd/role criar')).toBe(true);
  });

  it('deve identificar se a role da linha pertence ao usuário logado usando ownerRole', () => {
    fixture.detectChanges();

    const roleDaLinhaPertence: Role = { id: 1, name: 'Administrador', permissions: [] };
    const roleDaLinhaNaoPertence: Role = { id: 3, name: 'Medico', permissions: [] };

    expect(component['ownerRole'](roleDaLinhaPertence)).toBe(true);
    expect(component['ownerRole'](roleDaLinhaNaoPertence)).toBe(false);
  });

  it('deve abrir o dialog de edição e atualizar a lista enviando mensagem no canal ao confirmar', async () => {
    fixture.detectChanges();
    const targetRole: Role = { id: 2, name: 'Operador', permissions: [] };

    component['updateRole'](targetRole);

    await Promise.resolve();
    fixture.detectChanges();

    expect(dialogMock.open).toHaveBeenCalled();
    expect(roleServiceMock.getRoles).toHaveBeenCalled();
    expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
  });

  it('deve escutar o BroadcastChannel e atualizar a lista se receber a mensagem update', async () => {
    const ngZone = TestBed.inject(NgZone);
    fixture.detectChanges();

    expect(roleServiceMock.getRoles).toHaveBeenCalledTimes(1);

    // Força a execução dentro da zona do Angular para o evento ser capturado
    ngZone.run(() => {
      if (canalCallback) {
        canalCallback({ data: 'update' } as MessageEvent);
      }
    });

    await Promise.resolve();
    fixture.detectChanges();

    expect(roleServiceMock.getRoles).toHaveBeenCalledTimes(2);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.detectChanges();
    component.ngOnDestroy();

    expect(broadcastChannelMock.close).toHaveBeenCalled();
  });

  it('deve tratar erros da API de forma segura e fechar o loading sem estourar o teste', async () => {
    const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Simula uma falha na API. Como o componente possui bloco "error: () => {}", o fluxo cairá lá com segurança.
    roleServiceMock.getRoles.mockImplementation(() => throwError(() => new Error('Erro de Conexão')));

    fixture.detectChanges();
    await Promise.resolve();

    expect(roleServiceMock.getRoles).toHaveBeenCalled();
    expect(dialogRefMock.close).toHaveBeenCalled();
    expect(component['rolesList']()).toEqual([]); // Mantém o estado vazio seguro

    spyConsole.mockRestore();
  });
});
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';

// Componentes e Serviços do seu ecossistema
import { CreateRoleComponent } from './create-role-component';
import { RoleService } from '../../../services/role-service';
import { MessageService } from '../../../../core/services/message-service';
import { Permission } from '../../../models/permission.model';

describe('CreateRoleComponent', () => {
  let component: CreateRoleComponent;
  let fixture: ComponentFixture<CreateRoleComponent>;

  // Mocks das Dependências
  let roleServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Massa de dados fictícia para simular as permissões da API
  const mockPermissions: Permission[] = [
    { id: 1, name: 'tfd/usuário visualizar' },
    { id: 2, name: 'tfd/usuário criar' },
    { id: 3, name: 'tfd/regra atualizar' },
    { id: 4, name: 'tfd/unidade hospitalar deletar' }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    roleServiceMock = {
      getPermissions: vi.fn().mockReturnValue(of(mockPermissions)),
      createRole: vi.fn().mockReturnValue(of({ message: 'Regra criada com sucesso!' }))
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [CreateRoleComponent],
      providers: [
        FormBuilder,
        { provide: RoleService, useValue: roleServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: {} } // Passa um objeto vazio como fallback seguro
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreateRoleComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('should create e carregar as permissões no ngOnInit', () => {
    // Dispara o ciclo de vida inicial do Angular (ngOnInit)
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(roleServiceMock.getPermissions).toHaveBeenCalled();
    expect(component.permissions()).toEqual(mockPermissions);
    expect(component.isLoading()).toBe(false); // O finalize() deve desligar o loading
  });

  it('deve inicializar o formulário com valores padrão inválidos', () => {
    fixture.detectChanges();

    const form = component.createRoleForm;
    expect(form).toBeDefined();
    expect(form.get('name')?.value).toBe('');
    expect(form.get('permissions')?.value).toEqual([]);
    expect(form.invalid).toBe(true); // Nome está vazio (required)
  });

  it('deve filtrar as permissões por grupo corretamente usando getFilteredRole', () => {
    fixture.detectChanges();

    // Filtra pelo grupo 'usuário'
    const usuarioPermissions = component['getFilteredRole']('usuário');
    expect(usuarioPermissions).toHaveLength(2);
    expect(usuarioPermissions[0].name).toBe('tfd/usuário visualizar');

    // Filtra pelo grupo 'regra'
    const regraPermissions = component['getFilteredRole']('regra');
    expect(regraPermissions).toHaveLength(1);
    expect(regraPermissions[0].name).toBe('tfd/regra atualizar');

    // Filtra por um grupo inexistente
    const grupoInexistente = component['getFilteredRole']('financeiro');
    expect(grupoInexistente).toHaveLength(0);
  });

  it('deve gerenciar a inserção e remoção de IDs no array de permissões via togglePermission', () => {
    fixture.detectChanges();
    const permItem1 = mockPermissions[0]; // ID: 1
    const permItem2 = mockPermissions[1]; // ID: 2

    // 1. Adiciona a primeira permissão
    component['togglePermission'](permItem1);
    expect(component.createRoleForm.get('permissions')?.value).toEqual([1]);

    // 2. Adiciona a segunda permissão
    component['togglePermission'](permItem2);
    expect(component.createRoleForm.get('permissions')?.value).toEqual([1, 2]);

    // 3. Remove a primeira permissão clicando nela novamente
    component['togglePermission'](permItem1);
    expect(component.createRoleForm.get('permissions')?.value).toEqual([2]);
  });

  // 🛠️ CORREÇÃO 1: Ajustado de notFactory para .not.toHaveBeenCalled()
  it('não deve enviar o formulário (onSubmit) se ele for inválido', () => {
    fixture.detectChanges();
    
    component.onSubmit();

    expect(component.isSubmitting()).toBe(false);
    expect(roleServiceMock.createRole).not.toHaveBeenCalled(); // Sintaxe correta do Vitest
  });

  it('deve criar a regra com sucesso, exibir mensagem e fechar o diálogo passando true', () => {
    fixture.detectChanges();

    // Preenche o formulário com dados válidos (Mockando o CustomValidators com um array simulado)
    component.createRoleForm.get('name')?.setValue('Diretoria');
    component.createRoleForm.get('permissions')?.setValue([1, 2]); // Força valores para passar na validação
    component.createRoleForm.updateValueAndValidity();

    component.onSubmit();

    expect(component.isSubmitting()).toBe(false); // Desligado pelo finalize()
    expect(roleServiceMock.createRole).toHaveBeenCalledWith({ name: 'Diretoria', permissions: [1, 2] });
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Regra criada com sucesso!');
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });

  it('deve tratar erro no envio da API, exibir o alerta do back-end e manter o diálogo aberto', () => {
    fixture.detectChanges();
    
    // Simula falha controlada na API do serviço
    const errorResponse = { error: { message: 'Esta regra já existe no sistema.' } };
    roleServiceMock.createRole.mockReturnValue(throwError(() => errorResponse));

    component.createRoleForm.get('name')?.setValue('Admin');
    component.createRoleForm.get('permissions')?.setValue([3]);
    
    component.onSubmit();

    expect(component.isSubmitting()).toBe(false); // Desligado de forma segura pelo finalize()
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Esta regra já existe no sistema.');
    expect(dialogRefMock.close).not.toHaveBeenCalled(); // Garante que o modal não fechou na cara do usuário
  });

  // 🛠️ CORREÇÃO 2: Ajustada a expectativa para casar com o valor dinâmico do mock
  it('deve tratar falha silenciosa na busca inicial de permissões', () => {
    // Se o mock envia 'Erro de conexão.', o componente exibe 'Erro de conexão.'
    roleServiceMock.getPermissions.mockReturnValue(throwError(() => ({ error: { message: 'Erro de conexão.' } })));
    
    fixture.detectChanges(); // Dispara o ngOnInit que vai falhar

    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro de conexão.');
    expect(component.isLoading()).toBe(false); 
    expect(component.permissions()).toEqual([]);
  });
});
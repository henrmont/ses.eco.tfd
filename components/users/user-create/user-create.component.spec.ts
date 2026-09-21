import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateUserComponent } from './create-user-component';
import { UserService } from '../../../services/user-service';
import { MessageService } from '../../../../core/services/message-service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectChange } from '@angular/material/select';
import { of, throwError } from 'rxjs';
import { provideNgxMask } from 'ngx-mask';
import { Professionals } from '../../../enums/professionals';

describe('CreateUserComponent', () => {
  let component: CreateUserComponent;
  let fixture: ComponentFixture<CreateUserComponent>;

  let userServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = { title: 'Contexto de Teste' };

  beforeEach(async () => {
    userServiceMock = {
      emailUserExistsValidator: vi.fn().mockReturnValue(() => of(null)),
      createUser: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [CreateUserComponent],
      providers: [
        // Evita que o Vitest quebre tentando buscar estaticamente o pacote '@angular/animations'
        { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
        provideNgxMask(),
        { provide: UserService, useValue: userServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CreateUserComponent);
    component = fixture.componentInstance;
    
    // Dispara o ciclo de vida inicial do Angular (incluindo o ngOnInit que trava os campos)
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.isSubmitting()).toBe(false);
  });

  describe('Estado Inicial do Formulário', () => {
    it('deve inicializar os campos CBO e Registro Profissional desabilitados por padrão', () => {
      expect(component.createUserForm.get('cbo')?.disabled).toBe(true);
      expect(component.createUserForm.get('professional_register')?.disabled).toBe(true);
    });
  });

  describe('Reatividade do Formulário (Signals & Effects)', () => {
    it('deve habilitar o CBO e habilitar o Registro Profissional quando o tipo selecionado for Médico', async () => {
      component.onSelection({ value: Professionals.MEDICO } as MatSelectChange);
      await fixture.whenStable();

      expect(component.createUserForm.get('cbo')?.disabled).toBe(false);
      expect(component.createUserForm.get('professional_register')?.disabled).toBe(false);
    });

    it('deve desabilitar o CBO e habilitar o Registro Profissional quando o tipo selecionado for Assistente Social', async () => {
      component.onSelection({ value: Professionals.ASSISTENTE_SOCIAL } as MatSelectChange);
      await fixture.whenStable();

      expect(component.createUserForm.get('cbo')?.disabled).toBe(true);
      expect(component.createUserForm.get('professional_register')?.disabled).toBe(false);
    });

    it('deve desabilitar CBO e desabilitar Registro Profissional para outros tipos de profissionais (ex: Paciente)', async () => {
      component.onSelection({ value: Professionals.PACIENTE } as MatSelectChange);
      await fixture.whenStable();

      expect(component.createUserForm.get('cbo')?.disabled).toBe(true);
      expect(component.createUserForm.get('professional_register')?.disabled).toBe(true);
    });

    it('deve limpar o valor do campo CBO ao chamar o método resetCBO', () => {
      component.createUserForm.get('cbo')?.setValue('123456');
      component.resetCBO();
      expect(component.createUserForm.get('cbo')?.value).toBeNull();
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('não deve enviar a requisição se o formulário estiver inválido', () => {
      component.onSubmit();
      expect(userServiceMock.createUser).not.toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });

    it('deve criar o usuário com sucesso, exibir mensagem de sucesso e fechar o modal', async () => {
      component.createUserForm.patchValue({
        name: 'John Doe',
        email: 'john@example.com',
        type: Professionals.MEDICO,
        cns: '201234567890003',
        registration: '123456'
      });

      userServiceMock.createUser.mockReturnValue(of({ message: 'Usuário cadastrado com sucesso!' }));

      component.onSubmit();
      fixture.detectChanges();

      // Como o of() executa sincronicamente no teste, o finalize() já rodou aqui e o loading voltou a ser false
      expect(component.isSubmitting()).toBe(false);
      expect(userServiceMock.createUser).toHaveBeenCalledWith(component.createUserForm.getRawValue());
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Usuário cadastrado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar erro do servidor ao tentar criar o usuário e reverter o loading', () => {
      component.createUserForm.patchValue({
        name: 'John Doe',
        email: 'john@example.com',
        type: Professionals.MEDICO,
        cns: '201234567890003',
        registration: '123456'
      });

      const mockErrorResponse = { error: { message: 'Este e-mail já está em uso.' } };
      userServiceMock.createUser.mockReturnValue(throwError(() => mockErrorResponse));

      component.onSubmit();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Este e-mail já está em uso.');
      expect(component.isSubmitting()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve exibir mensagem de fallback padrão caso o backend retorne um erro sem mensagem explícita', () => {
      component.createUserForm.patchValue({
        name: 'John Doe',
        email: 'john@example.com',
        type: Professionals.MEDICO,
        cns: '201234567890003',
        registration: '123456'
      });

      userServiceMock.createUser.mockReturnValue(throwError(() => new Error('Falha Crítica')));

      component.onSubmit();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao criar o usuário');
      expect(component.isSubmitting()).toBe(false);
    });
  });
});
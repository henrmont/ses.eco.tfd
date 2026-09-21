import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserService, ApiResponse } from './user-service';
import { environment } from '../../../environments/environment
';
import { User } from '../models/user';
import { Role } from '../models/role';
import { FormControl } from '@angular/forms';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiTfdUrl}/user`;
  const validatorUrl = `${environment.apiTfdUrl}/validator`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Garante que nenhuma requisição HTTP ficou pendente ou aberta
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deve buscar a lista de usuários (getUsers)', () => {
    const mockUsers: User[] = [{ id: 1, name: 'John Doe', email: 'john@laravel.com' } as any];

    service.getUsers().subscribe((users) => {
      expect(users.length).toBe(1);
      expect(users).toEqual(mockUsers);
    });

    const req = httpMock.expectOne(`${baseUrl}/get-users`);
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers); // Devolve os dados falsos
  });

  it('deve buscar a lista de regras/roles (getRoles)', () => {
    const mockRoles: Role[] = [{ id: 1, name: 'Admin', permissions: [] }];

    service.getRoles().subscribe((roles) => {
      expect(roles).toEqual(mockRoles);
    });

    const req = httpMock.expectOne(`${baseUrl}/get-roles`);
    expect(req.request.method).toBe('GET');
    req.flush(mockRoles);
  });

  it('deve enviar uma requisição POST para criar usuário (createUser)', () => {
    const mockUser = { name: 'Novo Usuário', email: 'novo@teste.com' } as User;
    const mockResponse: ApiResponse = { message: 'Usuário criado com sucesso!' };

    service.createUser(mockUser).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${baseUrl}/create-user`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockUser); // Garante que enviou os dados no corpo
    req.flush(mockResponse);
  });

  it('deve enviar uma requisição PATCH para travar usuário com corpo vazio (lockUser)', () => {
    const userId = 123;
    const mockResponse: ApiResponse = { message: 'Usuário travado' };

    service.lockUser(userId).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${baseUrl}/lock-user/${userId}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({}); // 🛠️ Teste crítico: Garante que o corpo vai vazio {} e não quebra o Laravel
    req.flush(mockResponse);
  });

  it('deve enviar uma requisição PATCH para validar usuário com corpo vazio (validateUser)', () => {
    const userId = 123;
    const mockResponse: ApiResponse = { message: 'Usuário validado' };

    service.validateUser(userId).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${baseUrl}/validate-user/${userId}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush(mockResponse);
  });

  it('deve enviar uma requisição PATCH para atualizar dados (updateUser)', () => {
    const userId = 45;
    const updatedData = { name: 'Nome Atualizado' } as User;

    service.updateUser(userId, updatedData).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/update-user/${userId}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(updatedData);
    req.flush({});
  });

  it('deve enviar uma requisição DELETE para remover usuário (deleteUser)', () => {
    const userId = 99;

    service.deleteUser(userId).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/delete-user/${userId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('deve atualizar as permissões/roles do usuário (rolesUser)', () => {
    const userId = 10;
    const mockRoles: Role[] = [{ id: 2, name: 'Gerente', permissions: [] }];

    service.rolesUser(userId, mockRoles).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/roles-user/${userId}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(mockRoles);
    req.flush({});
  });

  // --- TESTES DOS VALIDATORES ASSÍNCRONOS ---

  describe('Async Validators', () => {
    
    it('deve retornar { emailExists: true } se o email já existir no validador', () => {
      const validatorFn = service.emailUserExistsValidator('antigo@email.com');
      const control = new FormControl('novo@email.com');

      // Executa o validador assíncrono passando o FormControl mockado
      (validatorFn(control) as any).subscribe((result: any) => {
        expect(result).toEqual({ emailExists: true });
      });

      const req = httpMock.expectOne(`${validatorUrl}/email-user-exists/novo@email.com/antigo@email.com`);
      expect(req.request.method).toBe('GET');
      req.flush(true); // Simula o Laravel respondendo "true" (existe)
    });

    it('deve retornar null se o email NÃO existir ou se a API falhar', () => {
      const validatorFn = service.emailUserExistsValidator('antigo@email.com');
      const control = new FormControl('novo@email.com');

      // Caso 1: API retorna false (Não existe)
      (validatorFn(control) as any).subscribe((result: any) => {
        expect(result).toBeNull();
      });

      let req = httpMock.expectOne(`${validatorUrl}/email-user-exists/novo@email.com/antigo@email.com`);
      req.flush(false);

      // Caso 2: API cai / dá erro (catchError ativa)
      (validatorFn(control) as any).subscribe((result: any) => {
        expect(result).toBeNull(); // Não deve quebrar o formulário do usuário
      });

      req = httpMock.expectOne(`${validatorUrl}/email-user-exists/novo@email.com/antigo@email.com`);
      req.error(new ProgressEvent('error')); // Força um erro de rede/HTTP
    });

    it('deve retornar null imediatamente se o campo de CNS estiver vazio', () => {
      const validatorFn = service.cnsUserExistsValidator('1234');
      const control = new FormControl(''); // Valor vazio

      (validatorFn(control) as any).subscribe((result: any) => {
        expect(result).toBeNull();
      });

      // Nenhuma requisição HTTP deve ser feita
      httpMock.expectNone(`${validatorUrl}/cns-user-exists//1234`);
    });

    it('deve validar corretamente a existência de CNS', () => {
      const validatorFn = service.cnsUserExistsValidator('cns-atual');
      const control = new FormControl('cns-digitado');

      (validatorFn(control) as any).subscribe((result: any) => {
        expect(result).toEqual({ cnsExists: true });
      });

      const req = httpMock.expectOne(`${validatorUrl}/cns-user-exists/cns-digitado/cns-atual`);
      req.flush(true);
    });
  });
});

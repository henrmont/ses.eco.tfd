import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { catchError, of } from 'rxjs';
import { UserService } from '../services/user.service'; // Serviço dentro do módulo TFD

export const tfdUserResolver: ResolveFn<any> = (route, state) => {
  const userService = inject(UserService);

  // Busca os dados atualizados do perfil profissional / lotações do usuário no módulo TFD
  return userService.getMe().pipe(
    catchError(() => of(null))
  );
};
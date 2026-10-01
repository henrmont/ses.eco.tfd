import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { MessageService } from '../../core/services/message-service';

export const professionalGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const messageService = inject(MessageService);

  // Rota de destino para redirecionamento em caso de erro/falha de permissão
  const INDEX_ROUTE = 'principal/tfd'; // Se a sua index for a raiz do módulo TFD (ou '/' para a raiz global)

  // 1. Recupera as informações passadas no data da rota
  const requiredTypes = route.data['types'] as string[] | undefined;
  const requiredPermission = route.data['permission'] as string | undefined;

  // 2. Obtém o usuário a partir do snapshot de dados resolvidos na rota
  const user = route.data['user'] || route.parent?.data['user'];

  if (!user) {
    messageService.showMessage('Sessão inválida ou dados do usuário não encontrados.');
    router.navigate([INDEX_ROUTE]);
    return false;
  }

  // ==========================================
  // Validação 1: Tipos Profissionais (Types)
  // ==========================================
  const userProfessionalTypes: string[] = (user?.professional?.types || []).map(
    (item: any) => (typeof item === 'string' ? item : item.type)
  );

  const hasValidType = !requiredTypes || requiredTypes.length === 0 
    ? true 
    : requiredTypes.some(type => userProfessionalTypes.includes(type));

  if (!hasValidType) {
    messageService.showMessage('Seu perfil profissional não possui acesso a este recurso.');
    router.navigate([INDEX_ROUTE]);
    return false;
  }

  // ==========================================
  // Validação 2: Permissões de Acesso (Permissions)
  // ==========================================
  if (requiredPermission) {
    const roles: any[] = user?.roles || [];
    const module = route.routeConfig?.path || route.parent?.routeConfig?.path || '';

    const userPermissions: string[] = roles.flatMap((role: any) =>
      (role.permissions || []).map((p: any) => p.name)
    );

    const fullPermissionName = module ? `${module}/${requiredPermission}` : requiredPermission;
    const hasValidPermission = userPermissions.includes(fullPermissionName) || userPermissions.includes(requiredPermission);

    if (!hasValidPermission) {
      messageService.showMessage('Você não possui a permissão necessária para acessar esta página.');
      router.navigate([INDEX_ROUTE]);
      return false;
    }
  }

  return true;
};
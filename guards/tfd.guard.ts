import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { MessageService } from '../../core/services/message.service';
import { TfdUser as User } from '../models/user.model';

// ============================================================================
// CONFIGURAÇÃO DO MÓDULO (Único bloco a alterar ao replicar para outro módulo)
// ============================================================================
const GUARD_CONFIG = {
  tag: '[TfdGuard]',
  moduleName: 'TFD',
  permissionPrefix: 'tfd/',
  moduleFallbackUrl: '/principal/tfd',
  globalFallbackUrl: '/principal/dashboard',
} as const;

export const tfdGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const messageService = inject(MessageService);
  const authService = inject(AuthService);

  const currentUser = authService.getCurrentUser();

  // 1. Se já está na memória com o perfil profissional carregado, valida direto
  if (currentUser?.professional) {
    return of(validateUser(currentUser, route, state, router, messageService));
  }

  // 2. Senão, busca no backend via AuthService
  return authService.getMe().pipe(
    map((user: User) => validateUser(user, route, state, router, messageService)),
    catchError((error) => {
      if (isDevMode()) {
        console.error(`${GUARD_CONFIG.tag} Erro ao buscar User:`, error);
      }
      messageService.showMessage(`Falha ao carregar permissões do módulo ${GUARD_CONFIG.moduleName}.`);
      return of(router.parseUrl(GUARD_CONFIG.globalFallbackUrl));
    })
  );
};

function validateUser(
  user: User,
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  router: Router,
  messageService: MessageService
): boolean | UrlTree {
  const requiredTypes = normalizeList(route.data['types']);
  const requiredPermissions = normalizeList(
    route.data['permissions'] ?? route.data['permission']
  );
  const requireAllPermissions = Boolean(route.data['requireAllPermissions']);

  // 1. Validar tipos profissionais (comparação exata)
  const userTypes = extractUserTypes(user);
  const hasValidType =
    requiredTypes.length === 0 ||
    requiredTypes.some((reqTarget) => userTypes.includes(reqTarget));

  if (!hasValidType) {
    if (isDevMode()) {
      console.warn(
        `${GUARD_CONFIG.tag} Perfil negado. Tipos do usuário:`,
        userTypes,
        'Exigidos:',
        requiredTypes
      );
    }
    messageService.showMessage(
      `Seu perfil profissional não possui acesso a este recurso do ${GUARD_CONFIG.moduleName}.`
    );
    return getSafeFallbackUrl(state.url, router);
  }

  // 2. Validar permissões
  if (requiredPermissions.length > 0) {
    const userPermissions = extractUserPermissions(user);
    const checkPermission = (requiredPerm: string) =>
      userPermissions.has(requiredPerm) ||
      userPermissions.has(`${GUARD_CONFIG.permissionPrefix}${requiredPerm}`);

    const hasValidPermission = requireAllPermissions
      ? requiredPermissions.every(checkPermission)
      : requiredPermissions.some(checkPermission);

    if (!hasValidPermission) {
      if (isDevMode()) {
        console.warn(
          `${GUARD_CONFIG.tag} Permissão negada:`,
          Array.from(userPermissions),
          'Exigidas:',
          requiredPermissions
        );
      }
      messageService.showMessage(
        `Você não possui a permissão necessária para acessar esta página do ${GUARD_CONFIG.moduleName}.`
      );
      return getSafeFallbackUrl(state.url, router);
    }
  }

  return true;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function normalizeList(value: unknown): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function extractUserTypes(user: User): string[] {
  const prof = user.professional as Record<string, unknown> | undefined;
  const rawTypes = prof?.['types'] ?? prof?.['type'] ?? [];
  const typesList = Array.isArray(rawTypes) ? rawTypes : [rawTypes];

  return typesList
    .map((item: unknown) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        return (obj['type'] ?? obj['name'] ?? '') as string;
      }
      return '';
    })
    .map((type) => type.trim().toLowerCase())
    .filter(Boolean);
}

function extractUserPermissions(user: User): Set<string> {
  const roles = user.roles || [];
  return new Set<string>(
    roles
      .flatMap((role) => role.permissions || [])
      .map((p) => p.name?.trim().toLowerCase())
      .filter((name): name is string => Boolean(name))
  );
}

function getSafeFallbackUrl(currentUrl: string, router: Router): UrlTree {
  const cleanCurrentUrl = currentUrl.split('?')[0].replace(/\/$/, '');
  const cleanModuleUrl = GUARD_CONFIG.moduleFallbackUrl.replace(/\/$/, '');

  // Evita loop infinito caso o bloqueio ocorra na própria rota index do módulo
  if (cleanCurrentUrl === cleanModuleUrl) {
    return router.parseUrl(GUARD_CONFIG.globalFallbackUrl);
  }

  return router.parseUrl(GUARD_CONFIG.moduleFallbackUrl);
}
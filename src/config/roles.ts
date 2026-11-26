import {
  cubeOutline,
  homeOutline,
  leafOutline,
  libraryOutline,
  medkitOutline,
  pawOutline,
  peopleOutline,
  scaleOutline,
  walkOutline,
} from 'ionicons/icons';

export type Rol = 'admin' | 'veterinario' | 'operario';

export const ROLES: readonly Rol[] = ['admin', 'veterinario', 'operario'];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  veterinario: 'Veterinario',
  operario: 'Operario',
};

export interface ModuloNavegacion {
  clave: string;
  etiqueta: string;
  ruta: string;
  icono: string;
  roles: readonly Rol[];
  enTabs: boolean;
}

export const MODULOS: readonly ModuloNavegacion[] = [
  { clave: 'dashboard', etiqueta: 'Inicio', ruta: '/tabs/dashboard', icono: homeOutline, roles: ROLES, enTabs: true },
  { clave: 'animales', etiqueta: 'Animales', ruta: '/tabs/animales', icono: pawOutline, roles: ROLES, enTabs: true },
  { clave: 'potreros', etiqueta: 'Potreros', ruta: '/tabs/potreros', icono: leafOutline, roles: ROLES, enTabs: true },
  { clave: 'pesajes', etiqueta: 'Pesajes', ruta: '/tabs/pesajes', icono: scaleOutline, roles: ROLES, enTabs: true },
  {
    clave: 'tratamientos',
    etiqueta: 'Tratamientos',
    ruta: '/tabs/tratamientos',
    icono: medkitOutline,
    roles: ['admin', 'veterinario'],
    enTabs: false,
  },
  {
    clave: 'rondas',
    etiqueta: 'Rondas',
    ruta: '/tabs/rondas',
    icono: walkOutline,
    roles: ['admin', 'operario'],
    enTabs: false,
  },
  {
    clave: 'insumos',
    etiqueta: 'Insumos',
    ruta: '/tabs/insumos',
    icono: cubeOutline,
    roles: ['admin', 'veterinario'],
    enTabs: false,
  },
  {
    clave: 'catalogos',
    etiqueta: 'Catálogos',
    ruta: '/tabs/catalogos',
    icono: libraryOutline,
    roles: ['admin'],
    enTabs: false,
  },
  {
    clave: 'usuarios',
    etiqueta: 'Usuarios',
    ruta: '/tabs/usuarios',
    icono: peopleOutline,
    roles: ['admin'],
    enTabs: false,
  },
];

export function rolesDeModulo(clave: string): readonly Rol[] {
  return MODULOS.find((modulo) => modulo.clave === clave)?.roles ?? ROLES;
}

export function rolPermitido(rol: string, permitidos?: readonly string[]): boolean {
  if (!permitidos || permitidos.length === 0) return true;
  return permitidos.includes(rol);
}

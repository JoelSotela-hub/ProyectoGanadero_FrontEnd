/**
 * Guardia de autenticación (Laboratorio 9 - Rol 6)
 * main.js lo importa en todas las páginas privadas (todas menos login.html).
 * No expone nada en window: solo ejecuta requireAuth() al cargarse el módulo.
 */
import { requireAuth } from './authSession.js';

requireAuth();

<template>
  <ion-page>
    <ion-content class="gg-auth-content" :scroll-x="false">
      <div class="gg-auth">
        <aside class="gg-auth__brand gg-on-dark" aria-label="GuateGanado, Gestión Ganadera">
          <div class="gg-auth__brand-top">
            <span class="gg-auth__logo" aria-hidden="true"><ion-icon :icon="pawOutline" /></span>
            <span class="gg-auth__brand-name">Gestión Ganadera</span>
          </div>

          <div class="gg-auth__hero">
            <p class="gg-auth__kicker"><span aria-hidden="true" class="gg-auth__kicker-line" />SISTEMA GANADERO</p>
            <p class="gg-auth__hero-title" aria-hidden="true">Control y <span>Registro</span></p>
            <p class="gg-auth__hero-text">
              Acceda al sistema integral para la administración de ganado, registro de aretes, seguimiento sanitario y
              trazabilidad productiva.
            </p>
          </div>

          <!-- Ilustración decorativa: colinas, curvas topográficas, sol y cerca -->
          <svg
            class="gg-auth__art"
            viewBox="0 0 600 560"
            preserveAspectRatio="xMidYMax slice"
            aria-hidden="true"
            focusable="false"
          >
            <g fill="none" stroke="#DDA15E" stroke-opacity="0.45" stroke-width="1.2">
              <ellipse cx="450" cy="70" rx="46" ry="30" />
              <ellipse cx="450" cy="70" rx="86" ry="56" />
              <ellipse cx="450" cy="70" rx="126" ry="82" />
              <ellipse cx="450" cy="70" rx="166" ry="108" />
              <ellipse cx="450" cy="70" rx="206" ry="134" />
            </g>
            <g fill="none" stroke="#C9CFB4" stroke-opacity="0.22" stroke-width="1.2">
              <path d="M0 170 C 120 140, 200 200, 320 170 S 520 150, 600 180" />
              <path d="M0 205 C 120 175, 200 235, 320 205 S 520 185, 600 215" />
              <path d="M0 240 C 120 210, 200 270, 320 240 S 520 220, 600 250" />
              <path d="M0 275 C 120 245, 200 305, 320 275 S 520 255, 600 285" />
              <path d="M0 310 C 120 280, 200 340, 320 310 S 520 290, 600 320" />
            </g>
            <circle cx="300" cy="330" r="62" fill="#DDA15E" />
            <path d="M0 400 C 120 340, 240 350, 340 395 S 520 430, 600 380 L600 560 L0 560 Z" fill="#606C38" />
            <path d="M0 450 C 140 400, 260 420, 360 455 S 540 490, 600 440 L600 560 L0 560 Z" fill="#55622F" />
            <path d="M0 505 C 160 470, 300 490, 600 485 L600 560 L0 560 Z" fill="#34461F" />
            <g stroke="#BC6C25" stroke-width="7" stroke-linecap="round">
              <path d="M170 470 L175 520" />
              <path d="M240 466 L246 518" />
              <path d="M310 462 L316 514" />
              <path d="M380 460 L386 512" />
              <path d="M165 487 L392 476" />
              <path d="M167 505 L394 494" />
            </g>
          </svg>

          <p class="gg-auth__copy">© 2026 Sistema Ganadero Profesional. Todos los derechos reservados.</p>
        </aside>

        <main class="gg-auth__panel">
          <div class="gg-auth__form">
            <slot />
          </div>
          <div class="gg-auth__foot">
            <slot name="pie" />
          </div>
        </main>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonIcon, IonPage } from '@ionic/vue';
import { pawOutline } from 'ionicons/icons';
</script>

<style>
ion-content.gg-auth-content {
  --background: var(--gg-canvas);
}

.gg-auth {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

/* ---- Panel de marca (móvil: cabecera compacta) ---- */
.gg-auth__brand {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--gg-forest);
  color: var(--gg-on-forest);
  padding: calc(0.9rem + var(--ion-safe-area-top)) max(1.25rem, var(--ion-safe-area-right)) 0.9rem
    max(1.25rem, var(--ion-safe-area-left));
  overflow: hidden;
}
.gg-auth__brand-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.7rem;
}
.gg-auth__logo {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.65rem;
  background: var(--gg-on-forest);
  color: var(--gg-forest);
  font-size: 1.3rem;
}
.gg-auth__brand-name {
  font-weight: 700;
  font-size: 1.05rem;
}
.gg-auth__hero,
.gg-auth__art,
.gg-auth__copy {
  display: none;
}

/* ---- Panel del formulario ---- */
.gg-auth__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.5rem;
  padding: 1.75rem max(1.25rem, var(--ion-safe-area-right)) calc(1.5rem + var(--ion-safe-area-bottom))
    max(1.25rem, var(--ion-safe-area-left));
  background: var(--gg-canvas);
}
.gg-auth__form {
  width: 100%;
  max-width: 26rem;
  margin: 0 auto;
}
.gg-auth__foot {
  width: 100%;
  max-width: 26rem;
  margin: 0 auto;
  font-size: 0.85rem;
  color: var(--gg-ink-muted);
}

@media (min-width: 48rem) {
  .gg-auth__panel {
    padding-top: 2.5rem;
  }
}

/* ---- Escritorio: 2 columnas 50 % / 50 % ---- */
@media (min-width: 62rem) {
  .gg-auth {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 100%;
    height: 100%;
  }
  .gg-auth__brand {
    padding: 2rem 3rem;
    justify-content: space-between;
  }
  .gg-auth__hero {
    position: relative;
    z-index: 1;
    display: block;
    max-width: 30rem;
    margin-top: 2rem;
  }
  .gg-auth__kicker {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: var(--gg-earth);
  }
  .gg-auth__kicker-line {
    width: 1.75rem;
    height: 2px;
    background: var(--gg-earth);
  }
  .gg-auth__hero-title {
    margin: 0 0 1rem;
    font-size: clamp(2.4rem, 3.4vw, 3.4rem);
    font-weight: 800;
    line-height: 1.05;
  }
  .gg-auth__hero-title span {
    color: var(--gg-earth);
  }
  .gg-auth__hero-text {
    margin: 0;
    color: var(--gg-on-forest-muted);
    line-height: 1.6;
  }
  .gg-auth__art {
    display: block;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 78%;
    pointer-events: none;
  }
  .gg-auth__copy {
    position: relative;
    z-index: 1;
    display: block;
    margin: 0;
    font-size: 0.78rem;
    color: var(--gg-on-forest-muted);
  }
  .gg-auth__panel {
    padding: 3rem 4rem;
  }
}

.gg-auth-eyebrow {
  margin: 0 0 0.3rem;
  font-size: 0.9rem;
  color: var(--gg-ink-muted);
}
.gg-auth-title {
  margin: 0 0 1.5rem;
  font-size: clamp(1.7rem, 1.3rem + 1.4vw, 2.1rem);
  font-weight: 800;
  line-height: 1.15;
  color: var(--gg-ink);
}
.gg-auth-title span {
  display: block;
  color: var(--gg-olive);
}
.gg-auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.gg-auth-foot {
  margin: 0;
}
</style>
